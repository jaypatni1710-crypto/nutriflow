import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload, User } from '../types/auth.types';

const ACCESS_TOKEN_EXPIRY = '15m';

function getSecret(jwtSecret: string): Uint8Array {
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(jwtSecret);
}

export async function signAccessToken(user: User, jwtSecret: string): Promise<string> {
  const secret = getSecret(jwtSecret);
  return new SignJWT({ sub: user.id, email: user.email, account_type: user.account_type })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secret);
}

export async function verifyAccessToken(token: string, jwtSecret: string): Promise<JWTPayload> {
  const secret = getSecret(jwtSecret);
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: payload.sub as string,
    email: payload['email'] as string,
    account_type: payload['account_type'] as string,
  };
}
