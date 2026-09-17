import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { applyIdScope, assertCanAccessEmployee, getOwnEmployee, isHrOrAdmin, requireUser, scopedEmployeeIds } from '../lib/access';
import { addDays, startOfDay } from '../lib/dates';
import { deriveAttendanceMetrics } from '../services/attendanceService';
import { formatWorkHours } from '../lib/dates';

export const getAttendance = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const { employeeId, from, to, status } = req.query;
  const ids = await scopedEmployeeIds(user);

  const where: Record<string, unknown> = applyIdScope({ tenantId: user.tenantId }, ids);
  if (employeeId) {
    await assertCanAccessEmployee(user, String(employeeId));
    where.employeeId = String(employeeId);
  }
  if (status) where.status = status;
  if (from || to) {
    const date: Record<string, Date> = {};
    if (from) date.gte = new Date(String(from));
    if (to) date.lte = new Date(String(to));
    where.date = date;
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, employeeId: true, department: { select: { name: true } } },
      },
    },
    orderBy: { date: 'desc' },
    take: 200,
  });

  res.json(records.map((r) => ({ ...r, workingHours: formatWorkHours(r.workMinutes) })));
};

export const getTodayAttendance = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const ids = await scopedEmployeeIds(user);

  const employeeWhere = applyIdScope({ tenantId: user.tenantId, status: 'Active' }, ids, 'id');
  const attWhere = applyIdScope({ tenantId: user.tenantId, date: { gte: today, lt: tomorrow } }, ids);

  const [total, present, late, absent, onLeave, records] = await Promise.all([
    prisma.employee.count({ where: employeeWhere }),
    prisma.attendance.count({ where: { ...attWhere, status: 'Present' } }),
    prisma.attendance.count({ where: { ...attWhere, status: 'Late' } }),
    prisma.attendance.count({ where: { ...attWhere, status: 'Absent' } }),
    prisma.leave.count({
      where: applyIdScope({
        tenantId: user.tenantId,
        status: 'Approved',
        fromDate: { lte: tomorrow },
        toDate: { gte: today },
      }, ids),
    }),
    prisma.attendance.findMany({
      where: attWhere,
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeId: true, department: { select: { name: true } } },
        },
      },
      orderBy: { checkIn: 'asc' },
    }),
  ]);

  res.json({
    summary: { total, present, late, absent, onLeave },
    records: records.map((r) => ({ ...r, workingHours: formatWorkHours(r.workMinutes) })),
  });
};

async function resolveTargetEmployeeId(req: Request) {
  const user = requireUser(req.user);
  const requestedId = req.body.employeeId as string | undefined;

  if (!isHrOrAdmin(user.role) && user.role !== 'Manager') {
    const own = await getOwnEmployee(user);
    if (!own) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'No employee profile is linked to this account');
    if (requestedId && requestedId !== own.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only check in or out for yourself');
    }
    return own.id;
  }

  if (!requestedId) throw new AppError(400, 'VALIDATION_ERROR', 'employeeId is required');
  await assertCanAccessEmployee(user, requestedId);
  return requestedId;
}

export const checkIn = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const employeeId = await resolveTargetEmployeeId(req);
  const today = startOfDay();

  const onLeave = await prisma.leave.findFirst({
    where: {
      tenantId: user.tenantId,
      employeeId,
      status: 'Approved',
      fromDate: { lte: addDays(today, 1) },
      toDate: { gte: today },
    },
  });
  if (onLeave) throw new AppError(409, 'ON_LEAVE', 'Employee is on approved leave today');

  const existing = await prisma.attendance.findFirst({
    where: { tenantId: user.tenantId, employeeId, date: today },
  });
  if (existing) throw new AppError(409, 'ALREADY_CHECKED_IN', 'Already checked in today');

  const now = new Date();
  const metrics = deriveAttendanceMetrics(now, null, now);
  const record = await prisma.attendance.create({
    data: {
      tenantId: user.tenantId,
      employeeId,
      date: today,
      checkIn: now,
      status: metrics.status,
      workMinutes: metrics.workMinutes,
      overtimeMinutes: metrics.overtimeMinutes,
      earlyCheckout: metrics.earlyCheckout,
    },
  });
  res.status(201).json(record);
};

export const checkOut = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const employeeId = await resolveTargetEmployeeId(req);
  const today = startOfDay();

  const record = await prisma.attendance.findFirst({
    where: { tenantId: user.tenantId, employeeId, date: today, checkOut: null },
  });
  if (!record || !record.checkIn) throw new AppError(404, 'NO_CHECKIN', 'No check-in found for today');

  const now = new Date();
  const metrics = deriveAttendanceMetrics(record.checkIn, now, now);
  const updated = await prisma.attendance.update({
    where: { id: record.id },
    data: {
      checkOut: now,
      workMinutes: metrics.workMinutes,
      overtimeMinutes: metrics.overtimeMinutes,
      earlyCheckout: metrics.earlyCheckout,
      status: metrics.status,
    },
  });
  res.json({ ...updated, workingHours: formatWorkHours(updated.workMinutes) });
};
