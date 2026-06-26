export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  organization_name: string;
  password_hash: string;
  account_type: 'admin' | 'dietitian';
  email_verified: boolean;
  email_verified_at: Date | null;
  status: 'pending' | 'active' | 'rejected' | 'suspended';
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PublicUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  organization_name: string;
  account_type: string;
  status: string;
  email_verified: boolean;
  email_verified_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
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
}

export interface RegisterInput {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  organization_name: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  remember_me?: boolean;
}
