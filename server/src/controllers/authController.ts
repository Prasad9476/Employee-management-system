import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { getJwtSecret } from '../middleware/auth';
import { requireUser } from '../lib/access';
import { findTenantRecord } from '../lib/access';
import {
  ACCESS_TOKEN_TTL,
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_MS,
  RESET_TOKEN_TTL_MS,
  clearRefreshCookie,
  hashToken,
  randomToken,
  setRefreshCookie,
} from '../lib/tokens';
import { sendEmail, makeResetLink } from '../services/emailService';
import { logAction } from '../utils/audit';

interface PublicUser {
  id: string;
  email: string;
  role: string;
  name: string;
  tenantId: string;
  mustChangePassword: boolean;
}

function toPublicUser(user: {
  id: string;
  email: string;
  role: string;
  name: string;
  tenantId: string;
  mustChangePassword?: boolean;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    tenantId: user.tenantId,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

async function issueTokens(res: Response, userId: string) {
  const refreshToken = randomToken(32);
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  setRefreshCookie(res, refreshToken);
  return signAccessToken(userId);
}

async function findTenantByOrgName(organizationName: string) {
  const tenant = await prisma.tenant.findUnique({ where: { name: organizationName } });
  if (!tenant) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }
  return tenant;
}

export const login = async (req: Request, res: Response) => {
  const { email, password, organizationName } = req.body;

  const tenant = await findTenantByOrgName(organizationName);
  const user = await prisma.user.findFirst({ where: { email, tenantId: tenant.id } });
  if (!user) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

  const token = await issueTokens(res, user.id);
  res.json({ token, user: toPublicUser(user) });
};

export const register = async (req: Request, res: Response) => {
  const { email, password, name, organizationName } = req.body;

  const existingOrg = await prisma.tenant.findUnique({ where: { name: organizationName } });
  if (existingOrg) throw new AppError(409, 'ORG_EXISTS', 'Organization name already taken');

  const hash = await bcrypt.hash(password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: organizationName } });
    const existingEmail = await tx.user.findFirst({ where: { tenantId: tenant.id, email } });
    if (existingEmail) throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');

    const user = await tx.user.create({
      data: { email, password: hash, name, role: 'Admin', tenantId: tenant.id },
    });

    await tx.role.createMany({
      data: [
        { tenantId: tenant.id, name: 'Admin' },
        { tenantId: tenant.id, name: 'HR' },
        { tenantId: tenant.id, name: 'Manager' },
        { tenantId: tenant.id, name: 'Employee' },
      ],
    });

    return { tenant, user };
  });

  const token = await issueTokens(res, result.user.id);

  await logAction({
    userId: result.user.id,
    tenantId: result.tenant.id,
    action: 'Registered organization',
    entity: 'Tenant',
    entityId: result.tenant.id,
    details: { organizationName },
  });

  res.status(201).json({
    token,
    user: toPublicUser(result.user),
    organization: { id: result.tenant.id, name: result.tenant.name },
  });
};

export const refresh = async (req: Request, res: Response) => {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  if (!cookieToken) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  }

  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hashToken(cookieToken), revokedAt: null },
  });
  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' } });
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  }

  // Rotate: revoke the presented token, issue a fresh one.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  const token = await issueTokens(res, user.id);

  res.json({ token, user: toPublicUser(user) });
};

export const logout = async (req: Request, res: Response) => {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  if (cookieToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(cookieToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearRefreshCookie(res);
  res.json({ success: true });
};

export const getMe = async (req: Request, res: Response) => {
  res.json({ user: req.user });
};

export const changePassword = async (req: Request, res: Response) => {
  const user = requireUser(req.user);
  const { currentPassword, newPassword } = req.body;

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');

  const valid = await bcrypt.compare(currentPassword, record.password);
  if (!valid) throw new AppError(400, 'WRONG_PASSWORD', 'Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash, mustChangePassword: false, lastPasswordChange: new Date() },
  });

  const currentCookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  await prisma.refreshToken.updateMany({
    where: {
      userId: user.id,
      revokedAt: null,
      NOT: currentCookie ? { tokenHash: hashToken(currentCookie) } : undefined,
    },
    data: { revokedAt: new Date() },
  });

  res.json({ success: true, message: 'Password updated' });
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email, organizationName } = req.body;

  // Generic response regardless of whether the user exists, to avoid enumeration.
  const respondGeneric = () =>
    res.json({ success: true, message: 'If an account matches, a reset link has been sent.' });

  const tenant = await prisma.tenant.findUnique({ where: { name: organizationName } });
  if (!tenant) return respondGeneric();

  const user = await prisma.user.findFirst({ where: { email, tenantId: tenant.id } });
  if (!user) return respondGeneric();

  const token = randomToken(32);
  await prisma.authToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      kind: 'RESET',
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  await sendEmail(user.email, 'Reset your EMS Pro password', `Use this link to reset your password (valid for 2 hours):\n${makeResetLink(token, 'reset')}`);

  return respondGeneric();
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body;

  const stored = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (
    !stored ||
    !['RESET', 'INVITE'].includes(stored.kind) ||
    stored.usedAt ||
    stored.expiresAt.getTime() < Date.now()
  ) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired');
  }

  const hash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: stored.userId },
      data: { password: hash, mustChangePassword: false, lastPasswordChange: new Date() },
    });
    await tx.authToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } });
    await tx.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
};

export const updateUserRole = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { role } = req.body;
  const tenantId = req.user!.tenantId;

  const existing = await findTenantRecord<{ id: string; role: string }, { id: string; tenantId: string }>(
    prisma.user,
    { id, tenantId },
    { code: 'USER_NOT_FOUND', message: 'User not found' },
  );

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, name: true, role: true, tenantId: true },
  });

  await logAction({
    userId: req.user!.id,
    tenantId,
    action: 'Changed user role',
    entity: 'User',
    entityId: id,
    details: { from: existing.role, to: role },
  });

  res.json(updated);
};