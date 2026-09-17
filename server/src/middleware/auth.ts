import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AuthUser, ROLES } from '../lib/access';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but was not set.');
  }
  return secret;
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }

    const payload = jwt.verify(token, getJwtSecret()) as { sub: string } | string;

    const subject = typeof payload === 'string' ? payload : payload.sub;
    if (!subject) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
    }

    const user = await prisma.user.findUnique({
      where: { id: subject },
      select: { id: true, email: true, name: true, role: true, tenantId: true, mustChangePassword: true },
    });
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
  }
};

/** Blocks all protected routes until a user with mustChangePassword changes it. */
export const requirePasswordChanged = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      success: false,
      error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'You must change your password before continuing' },
    });
  }
  return next();
};

export const authorize = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    }
    return next();
  };

export const getRoles = () => Object.values(ROLES);