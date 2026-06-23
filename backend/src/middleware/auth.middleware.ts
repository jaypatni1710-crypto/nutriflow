import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types/auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be defined and at least 32 characters long');
  }
  return secret;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JWTPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.account_type !== 'admin') {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return;
  }
  next();
}

export function requireDietitian(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.account_type !== 'dietitian') {
    res.status(403).json({ success: false, message: 'Dietitian access required' });
    return;
  }
  next();
}
