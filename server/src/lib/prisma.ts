import { PrismaClient } from '@prisma/client';

// Use a global singleton to avoid "too many connections" in dev and test isolation issues under Jest.
// In production, the module cache is stable, so global assignment is safe to skip.
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
