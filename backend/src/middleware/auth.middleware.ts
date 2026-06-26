import type { Context, Next } from 'hono';
import { verifyAccessToken } from '../utils/jwt';
import type { JWTPayload } from '../types/auth.types';

// Augment Hono's context variables
declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}

export async function authenticate(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ success: false, message: 'Invalid or expired token' }, 401);
  }
}

export async function requireAdmin(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('user');
  if (!user || user.account_type !== 'admin') {
    return c.json({ success: false, message: 'Admin access required' }, 403);
  }
  await next();
}

export async function requireDietitian(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('user');
  if (!user || user.account_type !== 'dietitian') {
    return c.json({ success: false, message: 'Dietitian access required' }, 403);
  }
  await next();
}
