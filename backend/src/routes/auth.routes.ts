import { Router, Request, Response, RequestHandler } from 'express';
import { AuthService } from '../services/auth.service';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  adminActionSchema,
  refreshTokenSchema,
  changeStatusSchema,
} from '../types/validation.schemas';

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  EMAIL_EXISTS: { status: 409, message: 'An account with this email already exists' },
  PHONE_EXISTS: { status: 409, message: 'An account with this phone number already exists' },
  INVALID_CREDENTIALS: { status: 401, message: 'Invalid email or password' },
  EMAIL_NOT_VERIFIED: { status: 403, message: 'Please verify your email before logging in' },
  ACCOUNT_PENDING: { status: 403, message: 'Your account is awaiting administrator approval' },
  ACCOUNT_REJECTED: { status: 403, message: 'Your registration request has been declined. Please contact support' },
  ACCOUNT_SUSPENDED: { status: 403, message: 'Your account has been suspended. Please contact support' },
  INVALID_TOKEN: { status: 400, message: 'Invalid or expired token' },
  TOKEN_EXPIRED: { status: 400, message: 'This link has expired. Please request a new one' },
  ALREADY_VERIFIED: { status: 400, message: 'Your email is already verified' },
  TOKEN_ALREADY_USED: { status: 400, message: 'This reset link has already been used' },
  USER_NOT_FOUND: { status: 404, message: 'User not found' },
  INVALID_REFRESH_TOKEN: { status: 401, message: 'Invalid session. Please login again' },
  REFRESH_TOKEN_EXPIRED: { status: 401, message: 'Session expired. Please login again' },
};

function handleError(res: Response, error: unknown): void {
  const err = error as Error;
  const mapped = ERROR_MESSAGES[err.message];
  if (mapped) {
    res.status(mapped.status).json({ success: false, message: mapped.message });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'An unexpected error occurred' });
}

export function createAuthRouter(authService: AuthService, authLimiter: RequestHandler, resendLimiter: RequestHandler): Router {
  const router = Router();

  // POST /auth/register
  router.post('/register', authLimiter, validate(registerSchema), async (req: Request, res: Response) => {
    try {
      await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'Account created successfully. Please verify your email before logging in.',
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /auth/login
  router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
    try {
      const tokens = await authService.login(req.body);
      res.json({ success: true, message: 'Login successful', data: tokens });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /auth/refresh-token
  router.post('/refresh-token', validate(refreshTokenSchema), async (req: Request, res: Response) => {
    try {
      const tokens = await authService.refreshTokens(req.body.refresh_token);
      res.json({ success: true, message: 'Token refreshed', data: tokens });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /auth/profile
  router.get('/profile', authenticate, async (req: Request, res: Response) => {
    try {
      const profile = await authService.getProfile(req.user!.sub);
      res.json({ success: true, data: profile });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /auth/logout
  router.post('/logout', async (req: Request, res: Response) => {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await authService.logout(refresh_token).catch(() => {});
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // POST /auth/verify-email
  router.post('/verify-email', validate(verifyEmailSchema), async (req: Request, res: Response) => {
    try {
      await authService.verifyEmail(req.body.token);
      res.json({ success: true, message: 'Email verified successfully. Your account is awaiting administrator approval.' });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /auth/resend-verification
  router.post('/resend-verification', resendLimiter, validate(resendVerificationSchema), async (req: Request, res: Response) => {
    try {
      await authService.resendVerification(req.body.email);
      res.json({ success: true, message: 'If that email is registered, a verification link has been sent.' });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /auth/forgot-password
  router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req: Request, res: Response) => {
    try {
      await authService.forgotPassword(req.body.email);
      res.json({ success: true, message: 'Password reset instructions have been sent to your email.' });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /auth/reset-password
  router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, message: 'Reset token is required' });
      return;
    }
    try {
      await authService.resetPassword(token, req.body.new_password);
      res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /admin/pending-accounts
  router.get('/admin/pending-accounts', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const users = await authService.getPendingAccounts();
      res.json({ success: true, message: 'Pending accounts retrieved', data: { users, total: users.length } });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /admin/approve-account
  router.post('/admin/approve-account', authenticate, requireAdmin, validate(adminActionSchema), async (req: Request, res: Response) => {
    try {
      await authService.approveAccount(req.body.user_id);
      res.json({ success: true, message: 'Account approved successfully' });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /admin/reject-account
  router.post('/admin/reject-account', authenticate, requireAdmin, validate(adminActionSchema), async (req: Request, res: Response) => {
    try {
      await authService.rejectAccount(req.body.user_id);
      res.json({ success: true, message: 'Account rejected' });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /admin/suspend-account
  router.post('/admin/suspend-account', authenticate, requireAdmin, validate(adminActionSchema), async (req: Request, res: Response) => {
    try {
      await authService.suspendAccount(req.body.user_id);
      res.json({ success: true, message: 'Account suspended' });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /admin/users — active / rejected / suspended (Users Panel)
  router.get('/admin/users', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const users = await authService.getAllUsers();
      res.json({ success: true, message: 'Users retrieved', data: { users, total: users.length } });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /admin/users/:id/status — Admin can change status anytime
  router.post('/admin/users/:id/status', authenticate, requireAdmin, validate(changeStatusSchema), async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      res.status(400).json({ success: false, message: 'Invalid user ID' });
      return;
    }
    try {
      await authService.changeUserStatus(id, req.body.status);
      res.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
      handleError(res, error);
    }
  });

  // NEW: DELETE /admin/users/:id — Delete user
  router.delete('/admin/users/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      res.status(400).json({ success: false, message: 'Invalid user ID' });
      return;
    }
    try {
      await authService.deleteUser(id);
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
}