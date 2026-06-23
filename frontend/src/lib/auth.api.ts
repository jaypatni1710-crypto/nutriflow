import { ApiResponse, AuthTokens, LoginFormData, RegisterFormData, User } from '../types/auth.types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/auth';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) throw data;
  return data;
}

export const authApi = {
  register: (body: RegisterFormData) =>
    request('/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: LoginFormData) =>
    request<AuthTokens>('/login', { method: 'POST', body: JSON.stringify(body) }),

  refreshToken: (refresh_token: string) =>
    request<AuthTokens>('/refresh-token', { method: 'POST', body: JSON.stringify({ refresh_token }) }),

  logout: (refresh_token: string) =>
    request('/logout', { method: 'POST', body: JSON.stringify({ refresh_token }) }),

  verifyEmail: (token: string) =>
    request('/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),

  resendVerification: (email: string) =>
    request('/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),

  forgotPassword: (email: string) =>
    request('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, new_password: string, confirm_password: string) =>
    request('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password, confirm_password }),
    }),

  // Admin
  getPendingAccounts: () =>
    request<{ users: User[]; total: number }>('/admin/pending-accounts'),

  approveAccount: (user_id: string) =>
    request('/admin/approve-account', { method: 'POST', body: JSON.stringify({ user_id }) }),

  rejectAccount: (user_id: string) =>
    request('/admin/reject-account', { method: 'POST', body: JSON.stringify({ user_id }) }),

  suspendAccount: (user_id: string) =>
    request('/admin/suspend-account', { method: 'POST', body: JSON.stringify({ user_id }) }),

  getAllUsers: () =>
    request<{ users: User[]; total: number }>('/admin/users'),

  getProfile: () => request<User>('/profile'),

  changeUserStatus: (user_id: string, status: 'active' | 'rejected' | 'suspended') =>
    request(`/admin/users/${user_id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  // NEW: Delete user
  deleteUser: (userId: string) =>
    request(`/admin/users/${userId}`, { method: 'DELETE' }),
};