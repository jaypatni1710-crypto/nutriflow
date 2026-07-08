import { DietPlan, DietPlanInput } from '../types/diet-plan.types';

const BASE = `${import.meta.env.VITE_API_URL || ''}/api/diet-plans`;

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

export const dietPlanApi = {
  list: () => request<{ success: boolean; data: DietPlan[] }>(''),

  create: (body: Partial<DietPlanInput>) =>
    request<{ success: boolean; data: DietPlan }>('', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Partial<DietPlanInput>) =>
    request<{ success: boolean; data: DietPlan }>(`/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  remove: (id: string) => request<{ success: boolean }>(`/${id}`, { method: 'DELETE' }),
};