const BASE = `${import.meta.env.VITE_API_URL || ''}/api/push`;

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

export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const pushApi = {
  getVapidPublicKey: () => request<{ success: boolean; data: { publicKey: string } }>('/vapid-public-key'),

  subscribe: (sub: PushSubscriptionJson) =>
    request<{ success: boolean }>('/subscribe', { method: 'POST', body: JSON.stringify(sub) }),

  unsubscribe: (endpoint: string) =>
    request<{ success: boolean }>('/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),
};