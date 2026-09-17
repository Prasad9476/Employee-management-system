import rateLimit from 'express-rate-limit';

const rateMessage = (message: string) => ({
  success: false,
  error: { code: 'RATE_LIMITED', message },
});

export function createLoginLimiter(
  opts: Partial<Parameters<typeof rateLimit>[0]> = {}
) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'test' ? 1000 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateMessage('Too many login attempts. Try again in 15 minutes.'),
    ...opts,
  });
}

export function createRegisterLimiter(
  opts: Partial<Parameters<typeof rateLimit>[0]> = {}
) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: process.env.NODE_ENV === 'test' ? 1000 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateMessage('Too many signup attempts. Try again in an hour.'),
    ...opts,
  });
}

export function createForgotLimiter(
  opts: Partial<Parameters<typeof rateLimit>[0]> = {}
) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'test' ? 1000 : 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateMessage('Too many reset requests. Try again in 15 minutes.'),
    ...opts,
  });
}

export const loginLimiter = createLoginLimiter();
export const registerLimiter = createRegisterLimiter();
export const forgotLimiter = createForgotLimiter();