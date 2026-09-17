import { Request, Response } from 'express';
import { Department, Prisma } from '@prisma/client';
import { logAction } from '../utils/audit';
import prisma from '../lib/prisma';
import { AppError, asyncHandler } from '../lib/errors';
import { findTenantRecord, requireUser } from '../lib/access';

export const getDepartments = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const tenantId = user.tenantId;
  const departments = await prisma.department.findMany({
    where: { tenantId },
    include: { _count: { select: { employees: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(departments);
});

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const tenantId = user.tenantId;
  const { name, budget, headId } = req.body;
  const dept = await prisma.department.create({
    data: { tenantId, name, budget: budget ? Number(budget) : null, headId },
  });

  await logAction({
    userId: user.id,
    tenantId,
    action: 'Created department',
    entity: 'Department',
    entityId: dept.id,
    details: { name, budget },
  });

  res.status(201).json(dept);
});

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const tenantId = user.tenantId;
  const id = String(req.params.id);
  await findTenantRecord<Department, Prisma.DepartmentWhereInput>(
    prisma.department,
    { id, tenantId },
    { code: 'DEPARTMENT_NOT_FOUND', message: 'Department not found' },
  );

  await prisma.department.update({ where: { id }, data: req.body });

  await logAction({
    userId: user.id,
    tenantId,
    action: 'Updated department',
    entity: 'Department',
    entityId: id,
    details: req.body,
  });

  const updated = await prisma.department.findFirst({ where: { id, tenantId } });
  res.json(updated);
});

export const deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const tenantId = user.tenantId;
  const id = String(req.params.id);
  await findTenantRecord<Department, Prisma.DepartmentWhereInput>(
    prisma.department,
    { id, tenantId },
    { code: 'DEPARTMENT_NOT_FOUND', message: 'Department not found' },
  );

  const deleted = await prisma.department.deleteMany({ where: { id, tenantId } });
  if (deleted.count === 0) throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found');

  await logAction({
    userId: user.id,
    tenantId,
    action: 'Deleted department',
    entity: 'Department',
    entityId: id,
  });

  res.json({ message: 'Department deleted' });
});