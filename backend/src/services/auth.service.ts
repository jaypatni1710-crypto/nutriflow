import type { Pool } from 'pg';
import type { AuthTokens, LoginInput, PublicUser, RegisterInput, User } from '../types/auth.types';
import { hashPassword, comparePassword, generateSecureToken, hashToken } from '../utils/crypto';
import { signAccessToken } from '../utils/jwt';

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
    // No email verification — save as pending directly, email_verified = true to skip that gate
    await this.db.query(
      `INSERT INTO users (first_name, last_name, email, phone_number, organization_name, address, qualification, experience, password_hash, account_type, email_verified, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'dietitian', true, 'pending') RETURNING id`,
      [
        input.first_name,
        input.last_name,
        input.email.toLowerCase(),
        input.phone_number,
        input.organization_name,
        input.address ?? null,
        input.qualification ?? null,
        input.experience ?? null,
        passwordHash,
      ]
    );
    // No verification email sent — admin will review
  }

  // Kept for compatibility (unused in new flow but routes still exist)
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
    // No-op in new flow
    return;
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const result = await this.db.query(`SELECT * FROM users WHERE email = $1`, [input.email.toLowerCase()]);
    if (result.rows.length === 0) throw new Error('INVALID_CREDENTIALS');
    const user: User = result.rows[0];

    const passwordMatch = await comparePassword(input.password, user.password_hash);
    if (!passwordMatch) throw new Error('INVALID_CREDENTIALS');

    if (user.status === 'pending') throw new Error('ACCOUNT_PENDING');
    if (user.status === 'suspended') throw new Error('ACCOUNT_SUSPENDED');

    if (user.status === 'rejected') {
      // Check temporary access
      if (user.temporary_access_end) {
        const now = new Date();
        const expiry = new Date(user.temporary_access_end);
        if (now <= expiry) {
          // Temporary access still valid — allow login
          const accessToken = await signAccessToken(user, this.jwtSecret);
          const refreshToken = await this.createRefreshToken(user.id, input.remember_me ?? false);
          await this.db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
          return {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: 15 * 60,
            temporary_access_end: expiry.toISOString(),
          };
        } else {
          throw new Error('ACCOUNT_TEMP_ACCESS_EXPIRED');
        }
      }
      throw new Error('ACCOUNT_REJECTED');
    }

    if (user.status !== 'approved') throw new Error('INVALID_CREDENTIALS');

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
    const { sendPasswordResetEmail } = await import('./email.service');
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
      `SELECT id, first_name, last_name, email, phone_number, organization_name, address, qualification, experience, account_type,
              status, email_verified, email_verified_at, decision_date,
              temporary_access_type, temporary_access_start, temporary_access_end,
              last_login_at, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
    return result.rows[0];
  }

  async getPendingAccounts(): Promise<PublicUser[]> {
    const result = await this.db.query(
      `SELECT id, first_name, last_name, email, phone_number, organization_name, address, qualification, experience, account_type,
              email_verified, email_verified_at, status, decision_date,
              temporary_access_type, temporary_access_start, temporary_access_end,
              last_login_at, created_at, updated_at
       FROM users WHERE account_type = 'dietitian' AND status = 'pending' ORDER BY created_at DESC`
    );
    return result.rows;
  }

  async approveAccount(userId: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE users SET status = 'approved', decision_date = NOW() WHERE id = $1 RETURNING email, first_name`,
      [userId]
    );
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
    // Email notifications disabled
  }

  async rejectAccount(userId: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE users SET status = 'rejected', decision_date = NOW(),
       temporary_access_type = NULL, temporary_access_start = NULL, temporary_access_end = NULL
       WHERE id = $1 RETURNING email, first_name`,
      [userId]
    );
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
    // Email notifications disabled
  }

  async suspendAccount(userId: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE users SET status = 'suspended', decision_date = NOW() WHERE id = $1 RETURNING email, first_name`,
      [userId]
    );
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
    await this.db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
    // Email notifications disabled
  }

  async getAllUsers(): Promise<PublicUser[]> {
    const result = await this.db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number, u.organization_name, u.address, u.qualification, u.experience, u.account_type,
              u.email_verified, u.email_verified_at, u.status, u.decision_date,
              u.temporary_access_type, u.temporary_access_start, u.temporary_access_end,
              u.last_login_at, u.created_at, u.updated_at, u.client_limit,
              COALESCE((SELECT COUNT(*)::int FROM clients c WHERE c.dietitian_id = u.id AND c.is_archived = false), 0) AS client_count
       FROM users u WHERE u.account_type = 'dietitian' AND u.status != 'pending' ORDER BY u.created_at DESC`
    );
    return result.rows;
  }

  async setClientLimit(userId: string, clientLimit: number | null): Promise<void> {
    const result = await this.db.query(
      `UPDATE users SET client_limit = $1 WHERE id = $2 RETURNING id`,
      [clientLimit, userId]
    );
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
  }

  async changeUserStatus(userId: string, status: 'approved' | 'rejected' | 'suspended'): Promise<void> {
    const result = await this.db.query(
      `UPDATE users SET status = $1, decision_date = NOW() WHERE id = $2 RETURNING email, first_name`,
      [status, userId]
    );
    if (result.rows.length === 0) throw new Error('USER_NOT_FOUND');
    if (status === 'suspended') {
      await this.db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
    } else if (status === 'rejected') {
      await this.db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
      // Clear temp access when re-rejecting
      await this.db.query(
        `UPDATE users SET temporary_access_type = NULL, temporary_access_start = NULL, temporary_access_end = NULL WHERE id = $1`,
        [userId]
      );
    }
    // Email notifications disabled
  }

  async grantTemporaryAccess(userId: string, accessType: '1_week' | '1_month'): Promise<void> {
    // Check user is rejected
    const check = await this.db.query(`SELECT status FROM users WHERE id = $1`, [userId]);
    if (check.rows.length === 0) throw new Error('USER_NOT_FOUND');
    if (check.rows[0].status !== 'rejected') throw new Error('INVALID_STATUS_FOR_TEMP_ACCESS');

    const now = new Date();
    let end: Date;
    if (accessType === '1_week') {
      end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      end = new Date(now);
      end.setMonth(end.getMonth() + 1);
    }

    await this.db.query(
      `UPDATE users SET temporary_access_type = $1, temporary_access_start = $2, temporary_access_end = $3 WHERE id = $4`,
      [accessType, now, end, userId]
    );
  }

  async clearTemporaryAccess(userId: string): Promise<void> {
    const check = await this.db.query(`SELECT status FROM users WHERE id = $1`, [userId]);
    if (check.rows.length === 0) throw new Error('USER_NOT_FOUND');
    await this.db.query(
      `UPDATE users SET temporary_access_type = NULL, temporary_access_start = NULL, temporary_access_end = NULL WHERE id = $1`,
      [userId]
    );
  }

  // Read-only lookup of every R2 file path belonging to a dietitian's clients.
  // Used by the admin "storage used" view — does not delete anything.
  async getUserFilePaths(userId: string): Promise<string[]> {
    const clientsRes = await this.db.query(`SELECT id FROM clients WHERE dietitian_id = $1`, [userId]);
    const clientIds: string[] = clientsRes.rows.map((r: any) => r.id);
    if (clientIds.length === 0) return [];

    const filesRes = await this.db.query(
      `SELECT file_path FROM client_lab_reports WHERE client_id = ANY($1)
       UNION ALL
       SELECT file_path FROM client_progress_photos WHERE client_id = ANY($1)`,
      [clientIds]
    );
    return filesRes.rows.map((r: any) => r.file_path).filter(Boolean);
  }

  async deleteUser(userId: string): Promise<{ filePaths: string[] }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const clientsRes = await client.query(`SELECT id FROM clients WHERE dietitian_id = $1`, [userId]);
      const clientIds: string[] = clientsRes.rows.map((r: any) => r.id);
      let filePaths: string[] = [];

      if (clientIds.length > 0) {
        const filesRes = await client.query(
          `SELECT file_path FROM client_lab_reports WHERE client_id = ANY($1)
           UNION ALL
           SELECT file_path FROM client_progress_photos WHERE client_id = ANY($1)`,
          [clientIds]
        );
        filePaths = filesRes.rows.map((r: any) => r.file_path).filter(Boolean);

        // Single round trip: all client-scoped deletes batched into one multi-statement query.
        await client.query(
          `DELETE FROM diet_plans WHERE client_id = ANY($1);
           DELETE FROM appointments WHERE client_id = ANY($1);
           DELETE FROM client_assessments WHERE client_id = ANY($1);
           DELETE FROM client_medical_history WHERE client_id = ANY($1);
           DELETE FROM client_notes WHERE client_id = ANY($1);
           DELETE FROM client_tags WHERE client_id = ANY($1);
           DELETE FROM client_communications WHERE client_id = ANY($1);
           DELETE FROM client_food_frequency WHERE client_id = ANY($1);
           DELETE FROM client_progress_logs WHERE client_id = ANY($1);
           DELETE FROM client_lab_reports WHERE client_id = ANY($1);
           DELETE FROM client_progress_photos WHERE client_id = ANY($1);
           DELETE FROM client_timeline WHERE client_id = ANY($1);
           DELETE FROM clients WHERE dietitian_id = $2;`,
          [clientIds, userId]
        );
      }

      // Single round trip: all user-scoped deletes batched into one multi-statement query.
      const result = await client.query(
        `DELETE FROM appointments WHERE dietitian_id = $1;
         DELETE FROM appointment_settings WHERE dietitian_id = $1;
         DELETE FROM push_subscriptions WHERE dietitian_id = $1;
         DELETE FROM refresh_tokens WHERE user_id = $1;
         DELETE FROM email_verification_tokens WHERE user_id = $1;
         DELETE FROM password_reset_tokens WHERE user_id = $1;
         DELETE FROM users WHERE id = $1 RETURNING id;`,
        [userId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('USER_NOT_FOUND');
      }

      await client.query('COMMIT');
      return { filePaths };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}