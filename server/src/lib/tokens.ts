import crypto from 'crypto';
import { Response } from 'express';

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ACCESS_TOKEN_TTL = '15m';
export const RESET_TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const REFRESH_COOKIE = 'ems_refresh';

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Secure cookies require HTTPS. Default to on in production, but allow an
// explicit override so HTTP-only deployments (e.g. a local docker-compose)
// still work; set COOKIE_SECURE=true once TLS terminates in front of the app.
function cookieSecure(): boolean {
  const override = process.env.COOKIE_SECURE;
  if (override !== undefined) return override === 'true';
  return process.env.NODE_ENV === 'production';
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: cookieSecure(),
    path: '/',
  };
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions(),
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
}