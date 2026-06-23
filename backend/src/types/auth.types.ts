export type AccountType = 'admin' | 'dietitian';
export type UserStatus = 'pending' | 'active' | 'rejected' | 'suspended';

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  organization_name: string;
  password_hash: string;
  account_type: AccountType;
  email_verified: boolean;
  email_verified_at: Date | null;
  status: UserStatus;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type PublicUser = Omit<User, 'password_hash'>;

export interface RegisterInput {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  organization_name: string;
  password: string;
  confirm_password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface JWTPayload {
  sub: string;
  email: string;
  account_type: AccountType;
  iat: number;
  exp: number;
}

export interface ApiResponse<T = void> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PendingAccountsResponse {
  users: PublicUser[];
  total: number;
}

export interface AllUsersResponse {
  users: PublicUser[];
  total: number;
}
