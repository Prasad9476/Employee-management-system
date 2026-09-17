import prisma from '../lib/prisma';

export async function notifyUser(
  userId: string,
  tenantId: string,
  type: string,
  message: string,
  data?: unknown,
) {
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
}

export async function notifyRole(tenantId: string, roles: string[], type: string, message: string, data?: unknown) {
  const users = await prisma.user.findMany({
    where: { tenantId, role: { in: roles } },
    select: { id: true },
  });
  await Promise.all(users.map((u) => notifyUser(u.id, tenantId, type, message, data)));
}
