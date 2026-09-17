import prisma from '../lib/prisma';

export const logAction = async ({
  userId,
  tenantId,
  action,
  entity,
  entityId,
  details,
}: {
  userId: string;
  tenantId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: unknown;
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        tenantId,
        action,
        entity,
        entityId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    });
  } catch (error) {
    console.error('Audit log failed', error);
  }
};
