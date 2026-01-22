import { doubleCsrf } from 'csrf-csrf';
import * as crypto from 'crypto';

const csrfSecret = process.env.CSRF_SECRET;
if (!csrfSecret && process.env.NODE_ENV === 'production') {
  throw new Error('CSRF_SECRET is required in production');
}
const effectiveCsrfSecret = csrfSecret ?? crypto.randomBytes(32).toString('hex');

export const csrf = doubleCsrf({
  getSecret: () => effectiveCsrfSecret,
  getSessionIdentifier: () => 'static-session',
  cookieName: 'csrf_token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
  getCsrfTokenFromRequest: (req) => req.headers?.['x-csrf-token'] as string,
  errorConfig: {
    statusCode: 403,
    message: 'CSRF token missing or invalid',
  },
  skipCsrfProtection: (req) => {
    const method = (req.method ?? '').toUpperCase();
    const isUnsafe =
      method === 'POST' ||
      method === 'PUT' ||
      method === 'PATCH' ||
      method === 'DELETE';
    if (!isUnsafe) return true;

    if (req.originalUrl?.startsWith('/checkout/webhook')) return true;

    const hasAuthCookie = Boolean((req as any)?.cookies?.access_token);
    return !hasAuthCookie;
  },
});
