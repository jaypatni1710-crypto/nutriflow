import type { Pool } from 'pg';
import type { AuthTokens, LoginInput, PublicUser, RegisterInput, User } from '../types/auth.types';
import { hashPassword, comparePassword, generateSecureToken, hashToken } from '../utils/crypto';
import { signAccessToken } from '../utils/jwt';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendSuspensionEmail,
} from './email.service';

const REFRESH_TOKEN_EXPIRY_DEFAULT = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY_REMEMBER = 30 * 24 * 60 * 60 * 1000;

interface EmailConfig {
  resendApiKey: string;
  from: string;
  frontendUrl: string;
}

export class AuthService {
  constructor(
    private db: Pool,
    private jwtSecret: string,
    private emailCfg: EmailConfig
  ) {}

  private async createRefreshToken(userId: string, rememberMe: boolean): Promise<string> {
    const token = generateSecureToken();
    const tokenHash = await hashToken(token);
    const expiryMs = rememberMe ? REFRESH_TOKEN_EXPIRY_REMEMBER : REFRESH_TOKEN_EXPIRY_DEFAULT;
    const expiresAt = new Date(Date.now() + expiryMs);
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
    return token;
  }

  async register(input: RegisterInput): Promise<void> {
    const existing = await this.db.query(
      `SELECT id, email, phone_number FROM users WHERE email = $1 OR phone_number = $2`,
      [input.email.toLowerCase(), input.phone_number]
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.email === input.email.toLowerCase()) throw new Error('EMAIL_EXISTS');
      if (row.phone_number === input.phone_number) throw new Error('PHONE_EXISTS');
    }

    const passwordHash = await hashPassword(input.password);
    const result = await this.db.query(
      `INSERT INTO users (first_name, last_name, email, phone_number, organization_name, password_hash, account_type, email_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'dietitian', false, 'pending') RETURNING id`,
      [input.first_name, input.last_name, input.email.toLowerCase(), input.phone_number, input.organization_name, passwordHash]
    );
    const userId = result.rows[0].id;
    await this.sendVerificationEmailForUser(userId, input.email.toLowerCase(), input.first_name);
  }

  private async sendVerificationEmailForUser(userId: string, email: string, firstName: string): Promise<void> {
    const token = generateSecureToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.db.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET token_hash = $2, expires_at = $3`,
      [userId, tokenHash, expiresAt]
    );
    await sendVerificationEmail(
      email, token, firstName,
      this.emailCfg.resendApiKey, this.emailCfg.from, this.emailCfg.frontendUrl
    );
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = await hashToken(token);
    const result = await this.db.query(
      `SELECT t.user_id, t.expires_at, u.email_verified
       FROM email_verification_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1`,
      [tokenHash]
    );
    if (result.rows.length === 0) throw new Error('INVALID_TOKEN');
    const row = result.rows[0];
    if (new Date() > new Date(row.expires_at)) throw new Error('TOKEN_EXPIRED');
    if (row.email_verified) throw new Error('ALREADY_VERIFIED');
    await this.db.query(`UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE id = $1`, [row.user_id]);
    await this.db.query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [row.user_id]);
  }

  async resendVerification(email: string): Promise<void> {
    const result = await this.db.query(
      `SELECT id, first_name, email_verified FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) return;
    const user = result.rows[0];
    if (user.email_verified) throw new Error('ALREADY_VERIFIED');
    await this.sendVerificationEmailForUser(user.id, email.toLowerCase(), user.first_name);
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const result = await this.db.query(`SELECT * FROM users WHERE email = $1`, [input.email.toLowerCase()]);
    if (result.rows.length === 0) throw new Error('INVALID_CREDENTIALS');
    const user: User = result.rows[0];

    const passwordMatch = await comparePassword(input.password, user.password_hash);
    if (!passwordMatch) throw new Error('INVALID_CREDENTIALS');

    if (!user.email_verified) throw new Error('EMAIL_NOT_VERIFIED');
    if (user.status === 'pending') throw new Error('ACCOUNT_PENDING');
    if (user.status === 'rejected') throw new Error('ACCOUNT_REJECTED');
    if (user.status === 'suspended') throw new Error('ACCOUNT_SUSPENDED');

    const accessToken = await signAccessToken(user, this.jwtSecret);
    const refreshToken = await this.createRefreshToken(user.id, input.remember_me ?? false);
    await this.db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
    return { access_token: accessToken, refresh_token: refreshToken, expires_in: 15 * 60 };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = await hashToken(refreshToken);
    const result = await this.db.query(
      `SELECT rt.user_id, rt.expires_at, rt.id as token_id, u.*
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    );
    if (result.rows.length === 0) throw new Error('INVALID_REFRESH_TOKEN');
    const row = result.rows[0];
    if (new Date() > new Date(row.expires_at)) throw new Error('REFRESH_TOKEN_EXPIRED');
    await this.db.query(`DELETE FROM refresh_tokens WHERE id = $1`, [row.token_id]);
    const user: User = row;
    const accessToken = await signAccessToken(user, this.jwtSecret);
    const newRefreshToken = await this.createRefreshToken(user.id, false);
    return { access_token: accessToken, refresh_token: newRefreshToken, expires_in: 15 * 60 };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = await hashToken(refreshToken);
    await this.db.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
  }

  async forgotPassword(email: string): Promise<void> {
    const result = await this.db.query(`SELECT id, first_name FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (result.rows.length === 0) return;
    const user = result.rows[0];
    const token = generateSecureToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );
    await sendPasswordResetEmail(
      email.toLowerCase(), token, user.first_name,
      this.emailCfg.resendApiKey, this.emailCfg.from, this.emailCfg.frontendUrl
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = await hashToken(token);
    const result = await this.db.query(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    if (result.rows.length === 0) throw new Error('INVALID_TOKEN');
    const row = result.rows[0];
    if (row.used_at) throw new Error('TOKEN_ALREADY_USED');
    if (new Date() > new Date(row.expires_at)) throw new Error('TOKEN_EXPIRED');
    const passwordHash = await hashPassword(newPassword);
    await this.db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, row.user_id]);
    await this.db.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
    await this.db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [row.user_id]);
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const result = await this.db.query(
      `SELECT id, first_name, last_name, email, phone_number, organization_name, account_type, status, email_verified, email_verified_at, last_login_at, created_at, updated_at FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
    return result.rows[0];
  }

  async getPendingAccounts(): Promise<PublicUser[]> {
    const result = await this.db.query(
      `SELECT id, first_name, last_name, email, phone_number, organization_name, account_type,
              email_verified, email_verified_at, status, last_login_at, created_at, updated_at
       FROM users WHERE account_type = 'dietitian' AND status = 'pending' ORDER BY created_at DESC`
    );
    return result.rows;
  }

  async approveAccount(userId: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE users SET status = 'active' WHERE id = $1 RETURNING email, first_name`, [userId]
    );
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
    await sendApprovalEmail(
      result.rows[0].email, result.rows[0].first_name,
      this.emailCfg.resendApiKey, this.emailCfg.from, this.emailCfg.frontendUrl
    );
  }

  async rejectAccount(userId: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE users SET status = 'rejected' WHERE id = $1 RETURNING email, first_name`, [userId]
    );
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
    await sendRejectionEmail(result.rows[0].email, result.rows[0].first_name, this.emailCfg.resendApiKey, this.emailCfg.from);
  }

  async suspendAccount(userId: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE users SET status = 'suspended' WHERE id = $1 RETURNING email, first_name`, [userId]
    );
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
    await this.db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
    await sendSuspensionEmail(result.rows[0].email, result.rows[0].first_name, this.emailCfg.resendApiKey, this.emailCfg.from);
  }

  async getAllUsers(): Promise<PublicUser[]> {
    const result = await this.db.query(
      `SELECT id, first_name, last_name, email, phone_number, organization_name, account_type,
              email_verified, email_verified_at, status, last_login_at, created_at, updated_at
       FROM users WHERE account_type = 'dietitian' AND status != 'pending' ORDER BY created_at DESC`
    );
    return result.rows;
  }

  async changeUserStatus(userId: string, status: 'active' | 'rejected' | 'suspended'): Promise<void> {
    const result = await this.db.query(
      `UPDATE users SET status = $1 WHERE id = $2 RETURNING email, first_name`, [status, userId]
    );
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
    if (status === 'suspended') {
      await this.db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
      await sendSuspensionEmail(result.rows[0].email, result.rows[0].first_name, this.emailCfg.resendApiKey, this.emailCfg.from);
    } else if (status === 'rejected') {
      await this.db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
      await sendRejectionEmail(result.rows[0].email, result.rows[0].first_name, this.emailCfg.resendApiKey, this.emailCfg.from);
    } else if (status === 'active') {
      await sendApprovalEmail(result.rows[0].email, result.rows[0].first_name, this.emailCfg.resendApiKey, this.emailCfg.from, this.emailCfg.frontendUrl);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
    await this.db.query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [userId]);
    await this.db.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);
    const result = await this.db.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
  }
}
