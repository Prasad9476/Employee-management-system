import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { applyIdScope, assertCanAccessEmployee, findTenantRecord, getOwnEmployee, isHrOrAdmin, requireUser, scopedEmployeeIds } from '../lib/access';
import { hashToken, INVITE_TOKEN_TTL_MS, randomToken } from '../lib/tokens';
import { makeResetLink, sendEmail } from '../services/emailService';
import { logAction } from '../utils/audit';

type EmployeeWithRelations = Prisma.EmployeeGetPayload<{ include: { department: true; role: true } }>;

const DEFAULT_BALANCES = [
  { type: 'Annual', allocated: 12 },
  { type: 'Sick', allocated: 6 },
  { type: 'Emergency', allocated: 3 },
];

export const getEmployees = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const { page = 1, limit = 20, dept, status, search } = req.query;
  const ids = await scopedEmployeeIds(user);

  const where: Record<string, unknown> = applyIdScope({ tenantId: user.tenantId }, ids, 'id');
  if (dept) where.department = { name: dept };
  if (status) where.status = status;
  if (search) {
    const s = String(search);
    where.OR = [
      { firstName: { contains: s, mode: 'insensitive' } },
      { lastName: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { employeeId: { contains: s, mode: 'insensitive' } },
    ];
  }

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: { department: true, role: true, manager: { select: { id: true, firstName: true, lastName: true } } },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  res.json({ total, page: Number(page), limit: Number(limit), employees });
};

export const getEmployee = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const employee = await assertCanAccessEmployee(user, String(req.params.id));

  const full = await prisma.employee.findFirst({
    where: { id: employee.id, tenantId: user.tenantId },
    include: {
      department: true,
      role: true,
      manager: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      attendance: { take: 30, orderBy: { date: 'desc' } },
      leaves: { take: 20, orderBy: { createdAt: 'desc' } },
      payrolls: { take: 12, orderBy: { month: 'desc' } },
      performance: { take: 12, orderBy: { reviewDate: 'desc' } },
      leaveBalances: true,
    },
  });

  res.json(full);
};

export const createEmployee = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  if (!isHrOrAdmin(user.role) && user.role !== 'Manager') {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }

  const tenantId = user.tenantId;
  const body = req.body as Record<string, unknown>;

  const duplicate = await prisma.employee.findFirst({ where: { tenantId, email: String(body.email) } });
  if (duplicate) throw new AppError(409, 'EMAIL_EXISTS', 'Email already used in this organization');

  await findTenantRecord(prisma.department, { id: String(body.departmentId), tenantId }, { code: 'INVALID_DEPARTMENT', message: 'Invalid department' });

  let roleId = body.roleId ? String(body.roleId) : '';
  if (roleId) {
    await findTenantRecord(prisma.role, { id: roleId, tenantId }, { code: 'INVALID_ROLE', message: 'Invalid role' });
  } else {
    const employeeRole = await prisma.role.findFirst({ where: { tenantId, name: 'Employee' } });
    if (!employeeRole) throw new AppError(400, 'ROLE_MISSING', 'Employee role is not configured');
    roleId = employeeRole.id;
  }

  let result: { employee: EmployeeWithRelations; inviteToken: string; email: string } | undefined;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await prisma.$transaction(async (tx) => {
        // Atomic per-tenant sequence via a counter row — immune to the
        // read-then-increment race that findFirst(last employee) had.
        const empCounter = await tx.employeeCounter.upsert({
          where: { tenantId },
          create: { tenantId, value: 1 },
          update: { value: { increment: 1 } },
        });
        const nextId = `EMP-${String(empCounter.value).padStart(3, '0')}`;

        const tempPassword = randomToken(5);
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        const loginUser = await tx.user.create({
          data: {
            email: String(body.email),
            password: passwordHash,
            name: `${body.firstName} ${body.lastName}`,
            role: 'Employee',
            tenantId,
            mustChangePassword: true,
          },
        });

        const inviteToken = randomToken(32);
        await tx.authToken.create({
          data: {
            tokenHash: hashToken(inviteToken),
            userId: loginUser.id,
            kind: 'INVITE',
            expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
          },
        });

        const employee = await tx.employee.create({
          data: {
            tenantId,
            userId: loginUser.id,
            employeeId: nextId,
            firstName: String(body.firstName),
            lastName: String(body.lastName),
            email: String(body.email),
            phone: body.phone ? String(body.phone) : null,
            departmentId: String(body.departmentId),
            roleId,
            salary: Number(body.salary),
            joinDate: new Date(String(body.joinDate)),
            status: String(body.status || 'Active'),
            employmentType: String(body.employmentType || 'FullTime'),
            workMode: String(body.workMode || 'Onsite'),
            location: body.location ? String(body.location) : null,
            probationEndDate: body.probationEndDate ? new Date(String(body.probationEndDate)) : null,
            managerId: body.managerId ? String(body.managerId) : null,
            skills: Array.isArray(body.skills) ? JSON.stringify(body.skills) : '',
            emergencyContactName: body.emergencyContactName ? String(body.emergencyContactName) : null,
            emergencyContactPhone: body.emergencyContactPhone ? String(body.emergencyContactPhone) : null,
            emergencyContactRelation: body.emergencyContactRelation ? String(body.emergencyContactRelation) : null,
          },
          include: { department: true, role: true },
        });

        await tx.leaveBalance.createMany({
          data: DEFAULT_BALANCES.map((b) => ({
            tenantId,
            employeeId: employee.id,
            type: b.type,
            allocated: b.allocated,
            used: 0,
          })),
        });

        return { employee, inviteToken, email: String(body.email) };
      });
      break;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2002' && attempt < 3) continue;
      throw error;
    }
  }

  const final = result!;

  await sendEmail(
    final.email,
    'Welcome to EMS Pro — set your password',
    `You have been added to EMS Pro. Use this invite link to set your password (valid for 7 days):\n${makeResetLink(final.inviteToken, 'invite')}`,
  );

  await logAction({
    userId: user.id,
    tenantId,
    action: 'Created employee',
    entity: 'Employee',
    entityId: final.employee.id,
    details: { employeeId: final.employee.employeeId, name: `${final.employee.firstName} ${final.employee.lastName}` },
  });

  res.status(201).json(final.employee);
};

export const updateEmployee = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const id = String(req.params.id);
  await assertCanAccessEmployee(user, id);

  if (user.role === 'Employee') {
    const own = await getOwnEmployee(user);
    if (!own || own.id !== id) throw new AppError(403, 'FORBIDDEN', 'Forbidden');
    const allowed = ['phone', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation', 'skills'];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        data[key] = key === 'skills' && Array.isArray(req.body[key]) ? JSON.stringify(req.body[key]) : req.body[key];
      }
    }
    await prisma.employee.updateMany({ where: { id, tenantId: user.tenantId }, data });
  } else {
    if (req.body.salary !== undefined && !isHrOrAdmin(user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Only HR or Admin can change salary');
    }
    const data: Record<string, unknown> = {};
    const fields = [
      'firstName', 'lastName', 'email', 'phone', 'departmentId', 'roleId', 'status',
      'employmentType', 'workMode', 'location', 'managerId',
      'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
    ];
    for (const key of fields) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (req.body.salary !== undefined) data.salary = Number(req.body.salary);
    if (req.body.skills !== undefined) data.skills = Array.isArray(req.body.skills) ? JSON.stringify(req.body.skills) : '';
    if (req.body.probationEndDate !== undefined) data.probationEndDate = req.body.probationEndDate ? new Date(req.body.probationEndDate) : null;
    if (req.body.confirmationDate !== undefined) data.confirmationDate = req.body.confirmationDate ? new Date(req.body.confirmationDate) : null;
    if (req.body.resignationDate !== undefined) data.resignationDate = req.body.resignationDate ? new Date(req.body.resignationDate) : null;
    if (req.body.lastWorkingDay !== undefined) data.lastWorkingDay = req.body.lastWorkingDay ? new Date(req.body.lastWorkingDay) : null;

    const updated = await prisma.employee.updateMany({ where: { id, tenantId: user.tenantId }, data });
    if (updated.count === 0) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  }

  const updated = await prisma.employee.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { department: true, role: true },
  });

  await logAction({
    userId: user.id,
    tenantId: user.tenantId,
    action: user.role === 'Employee' ? 'Employee updated profile' : 'Updated employee',
    entity: 'Employee',
    entityId: id,
  });

  res.json(updated);
};

export const deleteEmployee = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const id = String(req.params.id);
  const employee = await prisma.employee.updateMany({
    where: { id, tenantId: user.tenantId },
    data: { status: 'Inactive' },
  });
  if (employee.count === 0) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');

  await logAction({
    userId: user.id,
    tenantId: user.tenantId,
    action: 'Deactivated employee',
    entity: 'Employee',
    entityId: id,
  });

  res.json({ message: 'Employee deactivated successfully' });
};

export const getRolesList = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const roles = await prisma.role.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: 'asc' } });
  res.json(roles);
};
