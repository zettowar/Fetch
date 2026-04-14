import client from './client';

export interface Paginated<T> {
  items: T[];
  total: number;
}

// --- Types ---

export interface DashboardStats {
  total_users: number;
  active_users: number;
  suspended_users: number;
  users_last_7d: number;
  total_dogs: number;
  pending_reports: number;
  open_tickets: number;
  unverified_rescues: number;
  unused_invites: number;
  total_feedback: number;
  reports_last_7d: number;
  oldest_pending_report_hours: number | null;
  oldest_open_ticket_hours: number | null;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  location_rough: string | null;
  is_active: boolean;
  is_verified: boolean;
  role: string;
  created_at: string;
  dog_count: number;
  strike_count: number;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export interface Strike {
  id: string;
  user_id: string;
  report_id: string | null;
  reason: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  source_screen: string | null;
  status: string;
  ticket_number: string;
  created_at: string;
}

export interface RescueAdmin {
  id: string;
  name: string;
  description: string;
  location: string | null;
  website: string | null;
  donation_url: string | null;
  verified: boolean;
  created_at: string;
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
}

export interface FeedbackEntry {
  id: string;
  user_id: string;
  screen_name: string | null;
  body: string;
  created_at: string;
}

export interface InviteCode {
  id: string;
  code: string;
  is_used: boolean;
  used_by: string | null;
  created_at: string;
}

// --- API Functions ---

export const getStats = async (): Promise<DashboardStats> =>
  (await client.get('/admin/stats')).data;

export interface DashboardTimeseries {
  dates: string[];
  new_users: number[];
  new_reports: number[];
  new_dogs: number[];
}

export const getStatsTimeseries = async (days = 14): Promise<DashboardTimeseries> =>
  (await client.get('/admin/stats/timeseries', { params: { days } })).data;

function readTotal(headers: unknown, fallback: number): number {
  const h = headers as { get?: (k: string) => string | null; [k: string]: unknown };
  const raw = typeof h?.get === 'function'
    ? h.get('x-total-count')
    : (h?.['x-total-count'] as string | undefined);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const searchUsers = async (
  params: { q?: string; offset?: number; limit?: number } = {},
): Promise<Paginated<AdminUser>> => {
  const res = await client.get('/admin/users/search', { params });
  return { items: res.data, total: readTotal(res.headers, res.data.length) };
};

export const getAdminUser = async (id: string): Promise<AdminUser> =>
  (await client.get(`/admin/users/${id}`)).data;

export const suspendUser = async (id: string) =>
  (await client.post(`/admin/users/${id}/suspend`)).data;

export const reinstateUser = async (id: string) =>
  (await client.post(`/admin/users/${id}/reinstate`)).data;

export const getReports = async (
  params: { status?: string; offset?: number; limit?: number } = {},
): Promise<Paginated<Report>> => {
  const res = await client.get('/admin/reports', {
    params: {
      status_filter: params.status ?? 'pending',
      offset: params.offset,
      limit: params.limit,
    },
  });
  return { items: res.data, total: readTotal(res.headers, res.data.length) };
};

export const reviewReport = async (id: string, data: { status: string; admin_notes?: string; apply_strike?: boolean; strike_reason?: string }) =>
  (await client.post(`/admin/reports/${id}/review`, data)).data;

export const getUserStrikes = async (userId: string): Promise<Strike[]> =>
  (await client.get(`/admin/strikes/${userId}`)).data;

export const getTickets = async (status = 'open'): Promise<SupportTicket[]> =>
  (await client.get('/support/tickets', { params: { status_filter: status } })).data;

export const updateTicket = async (id: string, data: { status: string; admin_notes?: string }) =>
  (await client.post(`/admin/tickets/${id}/update`, data)).data;

export const getAdminRescues = async (): Promise<RescueAdmin[]> =>
  (await client.get('/admin/rescues')).data;

export const verifyRescue = async (id: string) =>
  (await client.post(`/rescues/${id}/verify`)).data;

export const getFeedback = async (): Promise<FeedbackEntry[]> =>
  (await client.get('/feedback')).data;

export const getInvites = async (): Promise<InviteCode[]> =>
  (await client.get('/invites')).data;

export const generateInvites = async (count: number): Promise<InviteCode[]> =>
  (await client.post('/invites/generate', { count })).data;

export const createFAQ = async (data: { question: string; answer: string; category: string; sort_order?: number }): Promise<FAQEntry> =>
  (await client.post('/admin/faq', data)).data;

export const updateFAQ = async (id: string, data: Partial<{ question: string; answer: string; category: string; sort_order: number }>) =>
  (await client.patch(`/admin/faq/${id}`, data)).data;

export const deleteFAQ = async (id: string) =>
  (await client.delete(`/admin/faq/${id}`)).data;

export const grantEntitlement = async (data: { user_id: string; entitlement_key: string; source?: string }) =>
  (await client.post('/billing/grant', data)).data;

export const promoteUser = async (id: string) =>
  (await client.post(`/admin/users/${id}/promote`)).data;

export const demoteUser = async (id: string) =>
  (await client.post(`/admin/users/${id}/demote`)).data;

// --- Audit log ---

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata_: Record<string, unknown> | null;
  created_at: string;
}

export const getAuditLog = async (params?: {
  action?: string;
  target_type?: string;
  actor_id?: string;
  target_id?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> =>
  (await client.get('/admin/audit', { params })).data;

// --- Per-user detail ---

export const getUserReportsFiled = async (userId: string): Promise<Report[]> =>
  (await client.get(`/admin/users/${userId}/reports-filed`)).data;

export const getUserReportsAgainst = async (userId: string): Promise<Report[]> =>
  (await client.get(`/admin/users/${userId}/reports-against`)).data;

export const getUserRescues = async (userId: string): Promise<RescueAdmin[]> =>
  (await client.get(`/admin/users/${userId}/rescues`)).data;

// --- Content moderation: dogs ---

export interface AdminDog {
  id: string;
  name: string;
  breed: string | null;
  is_active: boolean;
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  photo_count: number;
  created_at: string;
}

export const getAdminDogs = async (
  params: { q?: string; active_only?: boolean; offset?: number; limit?: number } = {},
): Promise<Paginated<AdminDog>> => {
  const res = await client.get('/admin/dogs', { params });
  return { items: res.data, total: readTotal(res.headers, res.data.length) };
};

export const deactivateDog = async (id: string) =>
  (await client.post(`/admin/dogs/${id}/deactivate`)).data;

export const reactivateDog = async (id: string) =>
  (await client.post(`/admin/dogs/${id}/reactivate`)).data;

// --- Lost reports (admin) ---

export interface AdminLostReport {
  id: string;
  kind: string;
  status: string;
  description: string;
  reporter_id: string;
  reporter_name: string | null;
  dog_id: string | null;
  dog_name: string | null;
  created_at: string;
}

export const getAdminLostReports = async (
  params: { status?: string; offset?: number; limit?: number } = {},
): Promise<Paginated<AdminLostReport>> => {
  const res = await client.get('/admin/lost-reports', {
    params: {
      status_filter: params.status ?? 'open',
      offset: params.offset,
      limit: params.limit,
    },
  });
  return { items: res.data, total: readTotal(res.headers, res.data.length) };
};

export const closeLostReport = async (id: string) =>
  (await client.post(`/admin/lost-reports/${id}/close`)).data;
