export type AccountType = 'admin' | 'dietitian';
export type UserStatus = 'pending' | 'active' | 'rejected' | 'suspended';

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  organization_name: string;
  account_type: AccountType;
  email_verified: boolean;
  email_verified_at: string | null;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ApiResponse<T = void> {
  success: boolean;
  message: string;
  data?: T;
}

export interface LoginFormData {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  organization_name: string;
  password: string;
  confirm_password: string;
}

export interface ChatMessage {
  roomId: string;
  message: string;
  sender: 'user' | 'admin';
  senderName: string;
  timestamp: number;
}

export interface ChatRoom {
  roomId: string;
  userName: string;
  userEmail: string;
}
