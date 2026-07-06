import { ClientFormData, ClientFullProfile, ClientListResponse } from '../types/client.types';

// VITE_API_URL should be set to your Worker root, e.g.:
//   https://nutriflow-api.YOUR-SUBDOMAIN.workers.dev
// No trailing slash, no path suffix.
const BASE = `${import.meta.env.VITE_API_URL || ''}/api/clients`;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return {} as T;
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export const clientApi = {
  list: (params: { page?: number; limit?: number; search?: string; goal?: string; condition?: string; status?: string; tag?: string; archived?: boolean }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== false) qs.set(k, String(v));
    });
    return request<ClientListResponse>(`?${qs.toString()}`);
  },

  create: (body: ClientFormData) =>
    request<{ success: boolean; data: any }>('', { method: 'POST', body: JSON.stringify(body) }),

  get: (id: string) => request<{ success: boolean; data: ClientFullProfile }>(`/${id}/profile`),

  update: (id: string, body: Partial<ClientFormData>) =>
    request<{ success: boolean; data: any }>(`/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  remove: (id: string) => request<{ success: boolean }>(`/${id}`, { method: 'DELETE' }),

  uploadLabReport: (id: string, reportType: string, file: File) => {
    const form = new FormData();
    form.append('report_type', reportType);
    form.append('file', file);
    return request<{ success: boolean; data: any }>(`/${id}/lab-reports`, { method: 'POST', body: form });
  },

  downloadLabReport: async (id: string, reportId: string, filename: string) => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${BASE}/${id}/lab-reports/${reportId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  deleteLabReport: (id: string, reportId: string) =>
    request<{ success: boolean }>(`/${id}/lab-reports/${reportId}`, { method: 'DELETE' }),

  addNote: (id: string, title: string, content?: string) =>
    request<{ success: boolean; data: any }>(`/${id}/notes`, { method: 'POST', body: JSON.stringify({ title, content }) }),

  updateNote: (id: string, noteId: string, title: string, content?: string) =>
    request<{ success: boolean; data: any }>(`/${id}/notes/${noteId}`, { method: 'PUT', body: JSON.stringify({ title, content }) }),

  deleteNote: (id: string, noteId: string) =>
    request<{ success: boolean }>(`/${id}/notes/${noteId}`, { method: 'DELETE' }),

  // Food Frequency Questionnaire
  addFoodFrequency: (id: string, body: Record<string, string>) =>
    request<{ success: boolean; data: any }>(`/${id}/food-frequency`, { method: 'POST', body: JSON.stringify(body) }),

  listFoodFrequency: (id: string) => request<{ success: boolean; data: any[] }>(`/${id}/food-frequency`),

// Progress Photos
  uploadProgressPhoto: (id: string, photoType: 'before' | 'monthly', file: File) => {
    const form = new FormData();
    form.append('photo_type', photoType);
    form.append('photo', file);
    return request<{ success: boolean; data: any }>(`/${id}/progress-photos`, { method: 'POST', body: form });
  },

  progressPhotoUrl: (id: string, photoId: string) => `${BASE}/${id}/progress-photos/${photoId}/file`,

  getProgressPhotoBlobUrl: async (id: string, photoId: string) => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${BASE}/${id}/progress-photos/${photoId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to load photo');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  deleteProgressPhoto: (id: string, photoId: string) =>
    request<{ success: boolean }>(`/${id}/progress-photos/${photoId}`, { method: 'DELETE' }),

  downloadProgressPhoto: async (id: string, photoId: string, filename: string) => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${BASE}/${id}/progress-photos/${photoId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Status Management
  updateStatus: (id: string, status: string) =>
    request<{ success: boolean; data: any }>(`/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Timeline
  getTimeline: (id: string) => request<{ success: boolean; data: any[] }>(`/${id}/timeline`),

  // Feature 1: Communication Log
  addCommunication: (id: string, type: string, description?: string) =>
    request<{ success: boolean; data: any }>(`/${id}/communications`, { method: 'POST', body: JSON.stringify({ type, description }) }),

  updateCommunication: (id: string, commId: string, type: string, description?: string) =>
    request<{ success: boolean; data: any }>(`/${id}/communications/${commId}`, { method: 'PUT', body: JSON.stringify({ type, description }) }),

  deleteCommunication: (id: string, commId: string) =>
    request<{ success: boolean }>(`/${id}/communications/${commId}`, { method: 'DELETE' }),

  // Feature 3: Tags
  addTag: (id: string, tag: string) =>
    request<{ success: boolean; data: string[] }>(`/${id}/tags`, { method: 'POST', body: JSON.stringify({ tag }) }),

  removeTag: (id: string, tag: string) =>
    request<{ success: boolean; data: string[] }>(`/${id}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' }),

  listAllTags: () => request<{ success: boolean; data: string[] }>(`/tags`), // fixed: was /tags/all

  // Feature 4: Duplicate Detection
  checkDuplicate: (phone?: string, whatsapp?: string, email?: string) =>
    request<{ success: boolean; data: any[] }>(`/check-duplicate`, { method: 'POST', body: JSON.stringify({ phone_number: phone, whatsapp_number: whatsapp, email }) }),

  // Feature 5: Archive
  archiveClient: (id: string) =>
    request<{ success: boolean; data: any }>(`/${id}/archive`, { method: 'POST' }), // fixed: was PATCH

  restoreClient: (id: string) =>
    request<{ success: boolean; data: any }>(`/${id}/restore`, { method: 'POST' }), // fixed: was PATCH
};