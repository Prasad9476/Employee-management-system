import { AppError } from './errors';
import prisma from './prisma';

export const ROLES = {
  ADMIN: 'Admin',
  HR: 'HR',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  name?: string;
  tenantId: string;
  mustChangePassword?: boolean;
};

interface FindFirstDelegate<Where> {
  findFirst: (args: { where: Where }) => Promise<unknown>;
}

/**
 * Find a record scoped to the caller's tenant, throwing AppError(404) when missing.
 * Using this instead of hand-rolled findFirst makes tenant scoping structurally
 * impossible to forget.
 *
 * Usage:
 *   const leave = await findTenantRecord<Prisma.Leave, Prisma.LeaveWhereInput>(prisma.leave, { id, tenantId }, { code: 'LEAVE_NOT_FOUND', message: 'Leave not found' });
 */
export async function findTenantRecord<T, Where>(
  delegate: FindFirstDelegate<Where>,
  where: Where,
  options: { code?: string; message?: string } = {},
): Promise<T> {
  const record = (await delegate.findFirst({ where })) as T | null;
  if (!record) {
    throw new AppError(404, options.code || 'NOT_FOUND', options.message || 'Record not found');
  }
  return record;
}

export function isAdmin(role: string) {
  return role === ROLES.ADMIN;
}

export function isHrOrAdmin(role: string) {
  return role === ROLES.ADMIN || role === ROLES.HR;
}

export function canApproveLeave(role: string) {
  return role === ROLES.ADMIN || role === ROLES.HR || role === ROLES.MANAGER;
}

export function requireUser(user?: AuthUser | null): AuthUser {
  if (!user?.id || !user.tenantId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
  }
  return user;
}

export async function getOwnEmployee(user: AuthUser) {
  return prisma.employee.findFirst({
    where: {
      tenantId: user.tenantId,
      OR: [{ userId: user.id }, { email: user.email }],
    },
  });
}

/** null = entire tenant; string[] = restricted to these employee ids */
export async function scopedEmployeeIds(user: AuthUser): Promise<string[] | null> {
  if (isHrOrAdmin(user.role)) return null;

  const own = await getOwnEmployee(user);
  if (!own) return [];

  if (user.role === ROLES.MANAGER) {
    const reports = await prisma.employee.findMany({
      where: { tenantId: user.tenantId, managerId: own.id },
      select: { id: true },
    });
    return [own.id, ...reports.map((r) => r.id)];
  }

  return [own.id];
}

export async function assertCanAccessEmployee(user: AuthUser, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId: user.tenantId },
  });
  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  }

  const ids = await scopedEmployeeIds(user);
  if (ids && !ids.includes(employeeId)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this employee');
  }
  return employee;
}

export async function assertCanMutateEmployee(user: AuthUser, employeeId: string) {
  const employee = await assertCanAccessEmployee(user, employeeId);
  if (user.role === ROLES.EMPLOYEE) {
    const own = await getOwnEmployee(user);
    if (!own || own.id !== employeeId) {
      throw new AppError(403, 'FORBIDDEN', 'Employees can only update their own profile');
    }
  }
  return employee;
}

export function applyIdScope<T extends object>(
  where: T,
  ids: string[] | null,
  field: 'employeeId' | 'id' = 'employeeId',
): T {
  if (!ids) return where;
  return { ...where, [field]: { in: ids } };
}
