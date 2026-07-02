import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z
  .object({
    first_name: z.string().min(1, 'First name is required').max(100),
    last_name: z.string().min(1, 'Last name is required').max(100),
    email: z.string().min(1, 'Email is required').email('Invalid email format'),
    phone_number: z
      .string()
      .min(1, 'Phone number is required')
      .regex(/^[\+]?[0-9\s\-()]{7,20}$/, 'Invalid phone number'),
    organization_name: z.string().min(1, 'Organization name is required').max(255),
    address: z.string().max(500).optional().or(z.literal('')),
    qualification: z.string().max(255).optional().or(z.literal('')),
    experience: z
      .union([z.number(), z.string()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === '') return undefined;
        const num = typeof val === 'string' ? Number(val) : val;
        return Number.isFinite(num) ? num : undefined;
      })
      .refine((val) => val === undefined || val >= 0, { message: 'Experience must be a positive number' }),
    password: passwordSchema,
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  remember_me: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const resendVerificationSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
});

export const adminActionSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

export const changeStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'suspended'], { message: 'Invalid status' }),
});

export const temporaryAccessSchema = z.object({
  access_type: z.enum(['1_week', '1_month'], { message: 'Invalid access type' }),
});

// client_limit: null means unlimited; otherwise a non-negative integer cap
export const clientLimitSchema = z.object({
  client_limit: z.number().int().min(0, { message: 'Client limit cannot be negative' }).nullable(),
});