// Same-origin by default for Docker/Nginx deployment.
// In Vite dev, leave VITE_API_BASE empty so /api is proxied to the backend.
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function getApiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export interface TicketListItem {
  ticketId: number;
  ticketKey: string;
  platform?: string | null;
  versionFound?: string | null;
  buildFixed?: string | null;
  functionality?: string | null;
  issueTitle?: string | null;
  summary?: string | null;
  commentCount: number;
  latestCommentPreview?: string | null;
  lastImportedAt: string;
  updatedAt: string;
}

export interface SearchResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface TicketDetail {
  ticketId: number;
  ticketKey: string;
  platform?: string | null;
  versionFound?: string | null;
  buildFixed?: string | null;
  functionality?: string | null;
  issueTitle?: string | null;
  summary?: string | null;
  sourceInternalComments?: string | null;
  lastImportedAt: string;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
}

export interface Comment {
  commentId: number;
  commentText: string;
  createdByUserId?: number | null;
  createdByDisplayName?: string | null;
  createdByUsername?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  isPinned: boolean;
  mentions: Mention[];
}

export interface Mention {
  userId: number;
  displayName: string;
  username: string;
  email?: string | null;
}

export interface Metadata {
  totalTickets: number;
  inProcessTickets: number;
  ticketsWithComments: number;
  platforms: string[];
  functionalities: string[];
  buildFixedValues: string[];
  versionFoundValues: string[];
}

export interface AppUser {
  userId: number;
  displayName: string;
  email?: string | null;
  username: string;
  role: 'ADMIN' | 'END USER' | string;
  isActive: boolean;
}

export interface ImportResult {
  importBatchId: number;
  fileName: string;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  uploadedAt: string;
  errors: string[];
}

export interface ImportBatch {
  importBatchId: number;
  fileName: string;
  uploadedAt: string;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
}

export interface LoginResponse {
  token: string;
  mustChangePassword: boolean;
  user: AppUser;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = getApiUrl(path);
  const isFormData = init?.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...getAuthHeaders(),
    ...(init?.headers ?? {})
  };

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (err) {
    const target = API_BASE || 'same-origin /api or Vite proxy /api -> http://localhost:5152';
    throw new Error(`Could not reach the JIRA Hub backend API. Target: ${target}. Details: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (res.status === 401) {
    localStorage.removeItem('token');
    throw new Error('Your session expired or you are not logged in. Please log in again.');
  }

  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || text || `${res.status} ${res.statusText}`);
    } catch {
      throw new Error(text || `${res.status} ${res.statusText}`);
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

function appendParam(qs: URLSearchParams, key: string, value: unknown) {
  if (Array.isArray(value)) {
    if (value.length > 0) qs.set(key, value.join('|'));
    return;
  }

  if (value !== undefined && value !== null && value !== '') {
    qs.set(key, String(value));
  }
}

export async function login(username: string, password: string) {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request<{ message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

export async function getCurrentUser() {
  return request<AppUser>('/api/auth/me');
}

export async function getMetadata() {
  return request<Metadata>('/api/metadata');
}

export async function searchTickets(params: Record<string, string | number | boolean | string[] | undefined | null>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => appendParam(qs, key, value));
  return request<SearchResult<TicketListItem>>(`/api/tickets?${qs.toString()}`);
}

export async function getTicket(ticketKey: string) {
  return request<TicketDetail>(`/api/tickets/${encodeURIComponent(ticketKey)}`);
}

export async function addComment(ticketKey: string, commentText: string, createdByUserId?: number | null, isPinned = false) {
  return request(`/api/tickets/${encodeURIComponent(ticketKey)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ commentText, createdByUserId, isPinned })
  });
}

export async function editComment(commentId: number, commentText: string, updatedByUserId?: number | null) {
  return request(`/api/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify({ commentText, updatedByUserId })
  });
}

export async function deleteComment(commentId: number, deletedByUserId?: number | null) {
  const qs = new URLSearchParams();
  if (deletedByUserId !== undefined && deletedByUserId !== null) qs.set('deletedByUserId', String(deletedByUserId));
  return request(`/api/comments/${commentId}?${qs.toString()}`, { method: 'DELETE' });
}

export async function getUsers(search?: string) {
  const qs = new URLSearchParams();
  if (search) qs.set('search', search);
  return request<AppUser[]>(`/api/users?${qs.toString()}`);
}

export async function createUser(input: { displayName: string; email?: string; username: string; role?: string }) {
  return request<AppUser>('/api/users', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function updateUserRole(userId: number, role: string) {
  return request<AppUser>(`/api/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role })
  });
}

export async function importCsv(file: File, uploadedBy?: string) {
  const form = new FormData();
  form.append('file', file);
  const qs = new URLSearchParams();
  if (uploadedBy) qs.set('uploadedBy', uploadedBy);
  return request<ImportResult>(`/api/admin/import?${qs.toString()}`, {
    method: 'POST',
    body: form
  });
}

export async function getImports() {
  return request<ImportBatch[]>('/api/admin/imports');
}
