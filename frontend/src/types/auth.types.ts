export type AccountType = 'admin' | 'dietitian';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

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
  account_type: AccountType;
  email_verified: boolean;
  email_verified_at: string | null;
  status: UserStatus;
  decision_date: string | null;
  temporary_access_type: '1_week' | '1_month' | null;
  temporary_access_start: string | null;
  temporary_access_end: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  client_limit?: number | null;
  client_count?: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  temporary_access_end?: string | null;
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
  address: string;
  qualification: string;
  experience: string;
  password: string;
  confirm_password: string;
}

// Wire-format payload sent to the API: same shape as the form,
// but `experience` is a number (or omitted) rather than a raw string.
export type RegisterPayload = Omit<RegisterFormData, 'experience'> & {
  experience?: number;
};

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