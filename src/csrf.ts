import { doubleCsrf } from 'csrf-csrf';
import * as crypto from 'crypto';

const csrfSecret = process.env.CSRF_SECRET;
if (!csrfSecret && process.env.NODE_ENV === 'production') {
  throw new Error('CSRF_SECRET is required in production');
}
const effectiveCsrfSecret = csrfSecret ?? crypto.randomBytes(32).toString('hex');

const isProduction = process.env.NODE_ENV === 'production';

export const csrf = doubleCsrf({
  getSecret: () => effectiveCsrfSecret,
  // Use access_token as session identifier for per-session CSRF tokens
  getSessionIdentifier: (req) => {
    const accessToken = (req as any)?.cookies?.access_token;
    // Return a hash of the access token or a fallback for unauthenticated requests
    if (accessToken) {
      return crypto.createHash('sha256').update(accessToken).digest('hex').slice(0, 32);
    }
    return 'anonymous-session';
  },
  // Use __Host- prefix in production for extra security (requires secure + path=/)
  // In development, use a simple name since __Host- requires HTTPS
  cookieName: isProduction ? '__Host-csrf' : 'csrf_secret',
  cookieOptions: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
  // The token sent by the frontend in the header
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
    // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
    if (!isUnsafe) return true;

    // Skip for Stripe webhooks (they have their own signature verification)
    if (req.originalUrl?.startsWith('/checkout/webhook')) return true;

    // Only require CSRF for authenticated requests
    const hasAuthCookie = Boolean((req as any)?.cookies?.access_token);
    return !hasAuthCookie;
  },
});
