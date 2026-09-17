import { Request, Response } from 'express';
import { Leave, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { applyIdScope, assertCanAccessEmployee, findTenantRecord, getOwnEmployee, isHrOrAdmin, requireUser, scopedEmployeeIds } from '../lib/access';
import { leaveDurationDays } from '../lib/dates';
import { pagination } from '../lib/pagination';
import { logAction } from '../utils/audit';
import { notifyRole, notifyUser } from '../services/notificationService';

export const getLeaves = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const { status, employeeId, type } = req.query;
  const { page, limit, skip } = pagination(req.query);
  const ids = await scopedEmployeeIds(user);
  const where: Record<string, unknown> = applyIdScope({ tenantId: user.tenantId }, ids);
  if (status) where.status = status;
  if (type) where.type = type;
  if (employeeId) {
    await assertCanAccessEmployee(user, String(employeeId));
    where.employeeId = String(employeeId);
  }

  const [total, leaves, balances] = await Promise.all([
    prisma.leave.count({ where }),
    prisma.leave.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeId: true, department: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.leaveBalance.findMany({
      where: applyIdScope({ tenantId: user.tenantId } as Record<string, unknown>, ids, 'employeeId'),
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, department: { select: { name: true } } } } },
    }),
  ]);

  res.json({
    total,
    page,
    limit,
    leaves,
    balances: balances.map((b) => ({ ...b, remaining: b.allocated - b.used })),
  });
};

export const getLeaveBalances = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const employeeId = String(req.query.employeeId || '');
  const targetId = employeeId || (await getOwnEmployee(user))?.id;
  if (!targetId) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  await assertCanAccessEmployee(user, targetId);

  const balances = await prisma.leaveBalance.findMany({ where: { employeeId: targetId, tenantId: user.tenantId } });
  res.json(balances.map((b) => ({ ...b, remaining: b.allocated - b.used })));
};

export const applyLeave = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const { employeeId, type, fromDate, toDate, reason, isHalfDay } = req.body;

  if (!isHrOrAdmin(user.role) && user.role !== 'Manager') {
    const own = await getOwnEmployee(user);
    if (!own || own.id !== employeeId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only apply leave for yourself');
    }
  } else {
    await assertCanAccessEmployee(user, employeeId);
  }

  const from = new Date(fromDate);
  const to = new Date(toDate);
  const days = leaveDurationDays(from, to, Boolean(isHalfDay));
  if (days <= 0) throw new AppError(400, 'INVALID_DATES', 'Invalid leave duration');

  const overlap = await prisma.leave.findFirst({
    where: {
      tenantId: user.tenantId,
      employeeId,
      status: { in: ['Pending', 'Approved'] },
      fromDate: { lte: to },
      toDate: { gte: from },
    },
  });
  if (overlap) throw new AppError(409, 'LEAVE_OVERLAP', 'This leave overlaps an existing request');

  const balance = await prisma.leaveBalance.findFirst({
    where: { tenantId: user.tenantId, employeeId, type },
  });
  if (balance && balance.used + days > balance.allocated) {
    throw new AppError(400, 'INSUFFICIENT_BALANCE', `Insufficient ${type} leave balance`);
  }

  const leave = await prisma.leave.create({
    data: {
      tenantId: user.tenantId,
      employeeId,
      type,
      fromDate: from,
      toDate: to,
      reason,
      isHalfDay: Boolean(isHalfDay),
      status: 'Pending',
    },
    include: { employee: { select: { firstName: true, lastName: true, userId: true } } },
  });

  await logAction({
    userId: user.id,
    tenantId: user.tenantId,
    action: 'Applied leave',
    entity: 'Leave',
    entityId: leave.id,
    details: { employeeId, type, fromDate: from, toDate: to },
  });

  await notifyRole(
    user.tenantId,
    ['Admin', 'HR', 'Manager'],
    'LEAVE_REQUEST',
    `New ${type} leave request from ${leave.employee.firstName} ${leave.employee.lastName}`,
    { leaveId: leave.id },
  );

  res.status(201).json(leave);
};

export const updateLeaveStatus = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const { status, approvalComment } = req.body;

  const existing = await findTenantRecord<Leave, Prisma.LeaveWhereInput>(
    prisma.leave,
    { id: String(req.params.id), tenantId: user.tenantId },
    { code: 'LEAVE_NOT_FOUND', message: 'Leave not found' },
  );

  if (user.role === 'Manager') {
    const ids = await scopedEmployeeIds(user);
    if (ids && !ids.includes(existing.employeeId)) {
      throw new AppError(403, 'FORBIDDEN', 'You can only approve leave for your team');
    }
  }

  if (status === 'Approved' && existing.status !== 'Approved') {
    const days = leaveDurationDays(existing.fromDate, existing.toDate, existing.isHalfDay);
    const balance = await prisma.leaveBalance.findFirst({
      where: { tenantId: user.tenantId, employeeId: existing.employeeId, type: existing.type },
    });
    if (balance) {
      if (balance.used + days > balance.allocated) {
        throw new AppError(400, 'INSUFFICIENT_BALANCE', `Insufficient ${existing.type} leave balance`);
      }
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: { used: balance.used + days },
      });
    }
  }

  await prisma.leave.update({
    where: { id: existing.id },
    data: { status, approvalComment: approvalComment || existing.approvalComment },
  });

  const updatedLeave = await prisma.leave.findFirst({
    where: { id: existing.id },
    include: { employee: { select: { firstName: true, lastName: true, userId: true } } },
  });

  await logAction({
    userId: user.id,
    tenantId: user.tenantId,
    action: `Leave ${status}`,
    entity: 'Leave',
    entityId: existing.id,
    details: { status, approvalComment },
  });

  if (updatedLeave?.employee.userId && (status === 'Approved' || status === 'Rejected')) {
    await notifyUser(
      updatedLeave.employee.userId,
      user.tenantId,
      status === 'Approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      `Your ${existing.type} leave was ${status.toLowerCase()}`,
      { leaveId: existing.id, approvalComment },
    );
  }

  res.json(updatedLeave);
};

export const deleteLeave = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const existing = await findTenantRecord<Leave, Prisma.LeaveWhereInput>(
    prisma.leave,
    { id: String(req.params.id), tenantId: user.tenantId },
    { code: 'LEAVE_NOT_FOUND', message: 'Leave not found' },
  );
  if (existing.status !== 'Pending' && user.role !== 'Admin') {
    throw new AppError(400, 'LEAVE_LOCKED', 'Only pending leaves can be deleted');
  }

  await prisma.leave.delete({ where: { id: existing.id } });
  await logAction({
    userId: user.id,
    tenantId: user.tenantId,
    action: 'Deleted leave request',
    entity: 'Leave',
    entityId: existing.id,
  });
  res.json({ message: 'Leave deleted' });
};
