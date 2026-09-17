import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AppError, asyncHandler } from '../lib/errors';
import { requireUser } from '../lib/access';
import { pagination } from '../lib/pagination';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const { page, limit, skip } = pagination(req.query, 30, 100);
  const where = { userId: user.id, tenantId: user.tenantId };

  const [total, unread, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, read: false } }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);
  res.json({ total, unread, page, limit, notifications });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const notification = await prisma.notification.updateMany({
    where: { id: String(req.params.id), userId: user.id, tenantId: user.tenantId },
    data: { read: true },
  });
  if (notification.count === 0) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');

  const updated = await prisma.notification.findFirst({
    where: { id: String(req.params.id), userId: user.id },
  });
  res.json(updated);
});

export const createNotification = async (userId: string, tenantId: string, type: string, message: string, data?: unknown) => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        tenantId,
        type,
        message,
        data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      },
    });
  } catch (error) {
    console.error('Notification create failed', error);
  }
};
