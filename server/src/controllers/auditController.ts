import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/errors';
import { requireUser } from '../lib/access';
import { pagination } from '../lib/pagination';

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const { page, limit, skip } = pagination(req.query, 50, 200);
  const where: Record<string, unknown> = { tenantId: user.tenantId };
  if (req.query.action) where.action = req.query.action;
  if (req.query.entity) where.entity = req.query.entity;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
      skip,
      take: limit,
    }),
  ]);
  res.json({ total, page, limit, logs });
});