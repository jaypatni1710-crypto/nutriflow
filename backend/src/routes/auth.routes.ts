import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AuthService } from '../services/auth.service';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { checkRateLimit, AUTH_LIMITER, RESEND_LIMITER } from '../utils/rate-limit';
import {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema,
  verifyEmailSchema, resendVerificationSchema, adminActionSchema,
  refreshTokenSchema, changeStatusSchema, temporaryAccessSchema,
} from '../types/validation.schemas';

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  EMAIL_EXISTS:                  { status: 409, message: 'An account with this email already exists' },
  PHONE_EXISTS:                  { status: 409, message: 'An account with this phone number already exists' },
  INVALID_CREDENTIALS:           { status: 401, message: 'Invalid email or password' },
  EMAIL_NOT_VERIFIED:            { status: 403, message: 'Please verify your email before logging in' },
  ACCOUNT_PENDING:               { status: 403, message: 'ACCOUNT_PENDING' },
  ACCOUNT_REJECTED:              { status: 403, message: 'ACCOUNT_REJECTED' },
  ACCOUNT_TEMP_ACCESS_EXPIRED:   { status: 403, message: 'ACCOUNT_TEMP_ACCESS_EXPIRED' },
  ACCOUNT_SUSPENDED:             { status: 403, message: 'ACCOUNT_SUSPENDED' },
  INVALID_STATUS_FOR_TEMP_ACCESS:{ status: 400, message: 'Temporary access can only be granted to rejected users' },
  INVALID_TOKEN:                 { status: 400, message: 'Invalid or expired token' },
  TOKEN_EXPIRED:                 { status: 400, message: 'This link has expired. Please request a new one' },
  ALREADY_VERIFIED:              { status: 400, message: 'Your email is already verified' },
  TOKEN_ALREADY_USED:            { status: 400, message: 'This reset link has already been used' },
  USER_NOT_FOUND:                { status: 404, message: 'User not found' },
  INVALID_REFRESH_TOKEN:         { status: 401, message: 'Invalid session. Please login again' },
  REFRESH_TOKEN_EXPIRED:         { status: 401, message: 'Session expired. Please login again' },
};

function handleError(c: any, error: unknown) {
  const err = error as Error;
  const mapped = ERROR_MESSAGES[err.message];
  if (mapped) return c.json({ success: false, message: mapped.message }, mapped.status);
  console.error('Unhandled error:', err);
  return c.json({ success: false, message: 'An unexpected error occurred' }, 500);
}

export function createAuthRouter(authService: AuthService): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  // POST /register
  router.post('/register', zValidator('json', registerSchema), async (c) => {
    const { limited } = await checkRateLimit(c.env.RATE_LIMIT_KV, c.req.header('CF-Connecting-IP') || 'unknown', AUTH_LIMITER);
    if (limited) return c.json({ success: false, message: 'Too many requests. Please try again later.' }, 429);
    try {
      await authService.register(c.req.valid('json'));
      return c.json({ success: true, message: 'Account submitted successfully. Please wait for administrator approval.' }, 201);
    } catch (e) { return handleError(c, e); }
  });

  // POST /login
  router.post('/login', zValidator('json', loginSchema), async (c) => {
    const { limited } = await checkRateLimit(c.env.RATE_LIMIT_KV, c.req.header('CF-Connecting-IP') || 'unknown', AUTH_LIMITER);
    if (limited) return c.json({ success: false, message: 'Too many requests. Please try again later.' }, 429);
    try {
      const tokens = await authService.login(c.req.valid('json'));
      return c.json({ success: true, message: 'Login successful', data: tokens });
    } catch (e) { return handleError(c, e); }
  });

  // POST /refresh-token
  router.post('/refresh-token', zValidator('json', refreshTokenSchema), async (c) => {
    try {
      const tokens = await authService.refreshTokens(c.req.valid('json').refresh_token);
      return c.json({ success: true, message: 'Token refreshed', data: tokens });
    } catch (e) { return handleError(c, e); }
  });

  // GET /profile
  router.get('/profile', authenticate, async (c) => {
    try {
      const profile = await authService.getProfile(c.get('user').sub);
      return c.json({ success: true, data: profile });
    } catch (e) { return handleError(c, e); }
  });

  // POST /logout
  router.post('/logout', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (body.refresh_token) await authService.logout(body.refresh_token).catch(() => {});
    return c.json({ success: true, message: 'Logged out successfully' });
  });

  // POST /verify-email (kept for backward compat)
  router.post('/verify-email', zValidator('json', verifyEmailSchema), async (c) => {
    try {
      await authService.verifyEmail(c.req.valid('json').token);
      return c.json({ success: true, message: 'Email verified successfully.' });
    } catch (e) { return handleError(c, e); }
  });

  // POST /resend-verification (no-op now)
  router.post('/resend-verification', zValidator('json', resendVerificationSchema), async (c) => {
    return c.json({ success: true, message: 'If that email is registered, a verification link has been sent.' });
  });

  // POST /forgot-password
  router.post('/forgot-password', zValidator('json', forgotPasswordSchema), async (c) => {
    const { limited } = await checkRateLimit(c.env.RATE_LIMIT_KV, c.req.header('CF-Connecting-IP') || 'unknown', AUTH_LIMITER);
    if (limited) return c.json({ success: false, message: 'Too many requests. Please try again later.' }, 429);
    try {
      await authService.forgotPassword(c.req.valid('json').email);
      return c.json({ success: true, message: 'Password reset instructions have been sent to your email.' });
    } catch (e) { return handleError(c, e); }
  });

  // POST /reset-password
  router.post('/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
    const { limited } = await checkRateLimit(c.env.RATE_LIMIT_KV, c.req.header('CF-Connecting-IP') || 'unknown', AUTH_LIMITER);
    if (limited) return c.json({ success: false, message: 'Too many requests. Please try again later.' }, 429);
    const { token, new_password } = c.req.valid('json');
    if (!token) return c.json({ success: false, message: 'Reset token is required' }, 400);
    try {
      await authService.resetPassword(token, new_password);
      return c.json({ success: true, message: 'Password updated successfully.' });
    } catch (e) { return handleError(c, e); }
  });

  // --- Admin routes ---
  router.get('/admin/pending-accounts', authenticate, requireAdmin, async (c) => {
    try {
      const users = await authService.getPendingAccounts();
      return c.json({ success: true, message: 'Pending accounts retrieved', data: { users, total: users.length } });
    } catch (e) { return handleError(c, e); }
  });

  router.post('/admin/approve-account', authenticate, requireAdmin, zValidator('json', adminActionSchema), async (c) => {
    try {
      await authService.approveAccount(c.req.valid('json').user_id);
      return c.json({ success: true, message: 'Account approved successfully' });
    } catch (e) { return handleError(c, e); }
  });

  router.post('/admin/reject-account', authenticate, requireAdmin, zValidator('json', adminActionSchema), async (c) => {
    try {
      await authService.rejectAccount(c.req.valid('json').user_id);
      return c.json({ success: true, message: 'Account rejected' });
    } catch (e) { return handleError(c, e); }
  });

  router.post('/admin/suspend-account', authenticate, requireAdmin, zValidator('json', adminActionSchema), async (c) => {
    try {
      await authService.suspendAccount(c.req.valid('json').user_id);
      return c.json({ success: true, message: 'Account suspended' });
    } catch (e) { return handleError(c, e); }
  });

  router.get('/admin/users', authenticate, requireAdmin, async (c) => {
    try {
      const users = await authService.getAllUsers();
      return c.json({ success: true, message: 'Users retrieved', data: { users, total: users.length } });
    } catch (e) { return handleError(c, e); }
  });

  router.post('/admin/users/:id/status', authenticate, requireAdmin, zValidator('json', changeStatusSchema), async (c) => {
    const { id } = c.req.param();
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return c.json({ success: false, message: 'Invalid user ID' }, 400);
    try {
      await authService.changeUserStatus(id, c.req.valid('json').status);
      return c.json({ success: true, message: 'Status updated successfully' });
    } catch (e) { return handleError(c, e); }
  });

  // POST /admin/users/:id/temporary-access
  router.post('/admin/users/:id/temporary-access', authenticate, requireAdmin, zValidator('json', temporaryAccessSchema), async (c) => {
    const { id } = c.req.param();
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return c.json({ success: false, message: 'Invalid user ID' }, 400);
    try {
      await authService.grantTemporaryAccess(id, c.req.valid('json').access_type);
      return c.json({ success: true, message: 'Temporary access granted successfully' });
    } catch (e) { return handleError(c, e); }
  });

  // DELETE /admin/users/:id/temporary-access — clear/reset temporary access
  router.delete('/admin/users/:id/temporary-access', authenticate, requireAdmin, async (c) => {
    const { id } = c.req.param();
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return c.json({ success: false, message: 'Invalid user ID' }, 400);
    try {
      await authService.clearTemporaryAccess(id);
      return c.json({ success: true, message: 'Temporary access cleared' });
    } catch (e) { return handleError(c, e); }
  });

  router.delete('/admin/users/:id', authenticate, requireAdmin, async (c) => {
    const { id } = c.req.param();
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return c.json({ success: false, message: 'Invalid user ID' }, 400);
    try {
      await authService.deleteUser(id);
      return c.json({ success: true, message: 'User deleted successfully' });
    } catch (e) { return handleError(c, e); }
  });

  return router;
}