import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/index';
import prisma from '../src/lib/prisma';
import { hashToken, randomToken } from '../src/lib/tokens';

export const api = request(app);

export interface Session {
  token: string;
  user: { id: string; email: string; role: string; name: string; tenantId: string };
  cookie: string[];
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Wipes every table in dependency order so each test starts clean. */
export async function resetDb(): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.performance.deleteMany(),
    prisma.payroll.deleteMany(),
    prisma.leave.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.leaveBalance.deleteMany(),
    prisma.authToken.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.role.deleteMany(),
    prisma.department.deleteMany(),
    prisma.user.deleteMany(),
    prisma.employeeCounter.deleteMany(),
    prisma.tenant.deleteMany(),
  ]);
}

function cookieArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (value) return [value];
  return [];
}

export async function registerOrg(
  organizationName: string,
  email: string,
  password: string,
  name = 'Org Admin'
): Promise<Session> {
  const res = await api.post('/api/auth/register').send({ organizationName, email, password, name });
  if (res.status !== 201) {
    throw new Error(`register failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user, cookie: cookieArray(res.headers['set-cookie']) };
}

export async function login(email: string, password: string, organizationName: string) {
  const res = await api.post('/api/auth/login').send({ email, password, organizationName });
  return {
    res,
    token: res.body.token,
    user: res.body.user,
    cookie: cookieArray(res.headers['set-cookie']),
  };
}

export async function createDepartment(token: string, name: string) {
  const res = await api.post('/api/departments').set(authHeader(token)).send({ name });
  if (res.status !== 201) {
    throw new Error(`createDepartment failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export interface EmployeePayload {
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  salary: number;
  joinDate?: string;
  managerId?: string;
}

export async function createEmployee(token: string, payload: EmployeePayload) {
  const res = await api
    .post('/api/employees')
    .set(authHeader(token))
    .send({ ...payload, joinDate: payload.joinDate ?? '2025-01-01' });
  if (res.status !== 201) {
    throw new Error(`createEmployee failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

/** Sets a known password for an existing login user (e.g. an API-created employee). */
export async function setPassword(userId: string, password: string): Promise<void> {
  const hash = await bcrypt.hash(password, 4);
  await prisma.user.update({ where: { id: userId }, data: { password: hash } });
}

/** Creates a raw (un-hypered) reset/invite token row for the user and returns the raw token. */
export async function issueAuthToken(userId: string, kind: 'RESET' | 'INVITE'): Promise<string> {
  const token = randomToken(32);
  await prisma.authToken.create({
    data: { tokenHash: hashToken(token), userId, kind, expiresAt: new Date(Date.now() + 7200000) },
  });
  return token;
}