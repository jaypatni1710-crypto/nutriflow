// Brevo transactional email API — free tier: 300 emails/day, no domain needed
// (just a verified single sender email). Sign up at brevo.com

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  brevoApiKey: string,
  from: string
): Promise<void> {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'NutriFlow', email: from },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ Brevo error to ${to}:`, err);
    } else {
      console.log(`✅ Email sent to ${to}: ${subject}`);
    }
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, (err as Error).message);
    // Don't throw — registration/login should still succeed even if email fails
  }
}

export async function sendVerificationEmail(
  to: string, token: string, firstName: string,
  brevoApiKey: string, from: string, frontendUrl: string
): Promise<void> {
  const link = `${frontendUrl}/verify-email?token=${token}`;
  console.log(`📧 VERIFICATION TOKEN for ${to}: ${token}`);
  await sendEmail(to, 'Verify your NutriFlow account', `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f766e;">Welcome to NutriFlow, ${firstName}!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${link}" style="display: inline-block; background: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Verify Email</a>
      <p style="color: #64748b; font-size: 14px;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
      <p style="color: #64748b; font-size: 12px;">Link: ${link}</p>
    </div>
  `, brevoApiKey, from);
}

export async function sendPasswordResetEmail(
  to: string, token: string, firstName: string,
  brevoApiKey: string, from: string, frontendUrl: string
): Promise<void> {
  const link = `${frontendUrl}/reset-password?token=${token}`;
  console.log(`📧 PASSWORD RESET TOKEN for ${to}: ${token}`);
  await sendEmail(to, 'Reset your NutriFlow password', `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f766e;">Password Reset Request</h2>
      <p>Hi ${firstName},</p>
      <p>Click the link below to set a new password:</p>
      <a href="${link}" style="display: inline-block; background: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Reset Password</a>
      <p style="color: #64748b; font-size: 14px;">This link expires in 1 hour.</p>
    </div>
  `, brevoApiKey, from);
}

export async function sendApprovalEmail(
  to: string, firstName: string,
  brevoApiKey: string, from: string, frontendUrl: string
): Promise<void> {
  await sendEmail(to, 'Your NutriFlow account has been approved', `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f766e;">Account Approved!</h2>
      <p>Hi ${firstName},</p>
      <p>Your NutriFlow account has been approved. You can now log in.</p>
      <a href="${frontendUrl}/login" style="display: inline-block; background: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Login to NutriFlow</a>
    </div>
  `, brevoApiKey, from);
}

export async function sendRejectionEmail(
  to: string, firstName: string,
  brevoApiKey: string, from: string
): Promise<void> {
  await sendEmail(to, 'Your NutriFlow registration request', `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Registration Declined</h2>
      <p>Hi ${firstName},</p>
      <p>Your NutriFlow registration request has been declined by our administrator.</p>
      <p style="color: #64748b; font-size: 14px;">If you believe this is a mistake, please contact our support team.</p>
    </div>
  `, brevoApiKey, from);
}

export async function sendSuspensionEmail(
  to: string, firstName: string,
  brevoApiKey: string, from: string
): Promise<void> {
  await sendEmail(to, 'Your NutriFlow account has been suspended', `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d97706;">Account Suspended</h2>
      <p>Hi ${firstName},</p>
      <p>Your NutriFlow account has been suspended by an administrator.</p>
      <p style="color: #64748b; font-size: 14px;">If you believe this is a mistake, please contact our support team.</p>
    </div>
  `, brevoApiKey, from);
}