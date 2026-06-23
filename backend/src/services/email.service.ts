import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || 'noreply@nutriflow.app';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`✅ Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, (err as Error).message);
    // Registration should still succeed even if email fails
  }
}

export async function sendVerificationEmail(to: string, token: string, firstName: string): Promise<void> {
  const link = `${FRONTEND_URL}/verify-email?token=${token}`;
  console.log(`📧 VERIFICATION TOKEN for ${to}: ${token}`);
  console.log(`   🔗 Link: ${link}`);
  await sendEmail(to, 'Verify your NutriFlow account', `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f766e;">Welcome to NutriFlow, ${firstName}!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${link}" style="display: inline-block; background: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Verify Email</a>
      <p style="color: #64748b; font-size: 14px;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
      <p style="color: #64748b; font-size: 12px;">Link: ${link}</p>
    </div>
  `);
}

export async function sendPasswordResetEmail(to: string, token: string, firstName: string): Promise<void> {
  const link = `${FRONTEND_URL}/reset-password?token=${token}`;
  console.log(`📧 PASSWORD RESET TOKEN for ${to}: ${token}`);
  console.log(`   🔗 Link: ${link}`);
  await sendEmail(to, 'Reset your NutriFlow password', `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f766e;">Password Reset Request</h2>
      <p>Hi ${firstName},</p>
      <p>We received a request to reset your password. Click the link below to set a new password:</p>
      <a href="${link}" style="display: inline-block; background: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Reset Password</a>
      <p style="color: #64748b; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `);
}

export async function sendApprovalEmail(to: string, firstName: string): Promise<void> {
  await sendEmail(to, 'Your NutriFlow account has been approved', `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f766e;">Account Approved!</h2>
      <p>Hi ${firstName},</p>
      <p>Your NutriFlow account has been approved by an administrator. You can now log in and start using the platform.</p>
      <a href="${FRONTEND_URL}/login" style="display: inline-block; background: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Login to NutriFlow</a>
    </div>
  `);
}

export async function sendRejectionEmail(to: string, firstName: string): Promise<void> {
  await sendEmail(to, 'Your NutriFlow registration request', `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Registration Declined</h2>
      <p>Hi ${firstName},</p>
      <p>We regret to inform you that your NutriFlow registration request has been declined by our administrator.</p>
      <p style="color: #64748b; font-size: 14px;">If you believe this is a mistake, please contact our support team.</p>
    </div>
  `);
}

export async function sendSuspensionEmail(to: string, firstName: string): Promise<void> {
  await sendEmail(to, 'Your NutriFlow account has been suspended', `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d97706;">Account Suspended</h2>
      <p>Hi ${firstName},</p>
      <p>Your NutriFlow account has been suspended by an administrator. You will no longer be able to access the platform.</p>
      <p style="color: #64748b; font-size: 14px;">If you believe this is a mistake, please contact our support team.</p>
    </div>
  `);
}