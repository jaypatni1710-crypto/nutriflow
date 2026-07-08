const BASE = `${import.meta.env.VITE_API_URL || ''}/api/appointments`;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return {} as T;
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export interface ApiAppointment {
  id: string;
  client_id: string;
  client_name: string;
  status: 'new' | 'ongoing' | 'follow_up' | 'completed' | 'cancelled';
  appt_date: string;
  time_from: string;
  time_to: string;
  notes: string | null;
  tag: string | null;
  tag_other: string | null;
  created_at: string;
}

export interface ApiAppointmentSettings {
  max_per_day: number | null;
  duration_minutes: number | null;
  working_start: string | null;
  working_end: string | null;
}

export const appointmentApi = {
  list: () => request<{ success: boolean; data: ApiAppointment[] }>(''),

  create: (body: Omit<ApiAppointment, 'id' | 'created_at'>) =>
    request<{ success: boolean; data: ApiAppointment }>('', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Partial<Omit<ApiAppointment, 'id' | 'created_at'>>) =>
    request<{ success: boolean; data: ApiAppointment }>(`/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  remove: (id: string) => request<{ success: boolean }>(`/${id}`, { method: 'DELETE' }),

  getSettings: () => request<{ success: boolean; data: ApiAppointmentSettings }>('/settings'),

  saveSettings: (body: ApiAppointmentSettings) =>
    request<{ success: boolean; data: ApiAppointmentSettings }>('/settings', { method: 'PUT', body: JSON.stringify(body) }),
};