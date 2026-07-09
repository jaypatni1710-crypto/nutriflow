export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  organization_name: string;
  address: string | null;
  qualification: string | null;
  experience: number | null;
  password_hash: string;
  account_type: 'admin' | 'dietitian';
  email_verified: boolean;
  email_verified_at: Date | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  decision_date: Date | null;
  temporary_access_type: '1_week' | '1_month' | null;
  temporary_access_start: Date | null;
  temporary_access_end: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  client_limit: number | null;
}

export interface PublicUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  organization_name: string;
  telegram_chat_id: string | null;
  address: string | null;
  qualification: string | null;
  experience: number | null;
  account_type: string;
  status: string;
  email_verified: boolean;
  email_verified_at: Date | null;
  decision_date: Date | null;
  temporary_access_type: string | null;
  temporary_access_start: Date | null;
  temporary_access_end: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  client_limit?: number | null;
  client_count?: number;
}

export interface JWTPayload {
  sub: string;
  email: string;
  account_type: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  temporary_access_end?: string | null;
}

export interface RegisterInput {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  organization_name: string;
  address?: string;
  qualification?: string;
  experience?: number;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  remember_me?: boolean;
}