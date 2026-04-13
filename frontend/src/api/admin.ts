import client from './client';

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

export const searchUsers = async (q: string): Promise<AdminUser[]> =>
  (await client.get('/admin/users/search', { params: { q } })).data;

export const getAdminUser = async (id: string): Promise<AdminUser> =>
  (await client.get(`/admin/users/${id}`)).data;

export const suspendUser = async (id: string) =>
  (await client.post(`/admin/users/${id}/suspend`)).data;

export const reinstateUser = async (id: string) =>
  (await client.post(`/admin/users/${id}/reinstate`)).data;

export const getReports = async (status = 'pending'): Promise<Report[]> =>
  (await client.get('/admin/reports', { params: { status_filter: status } })).data;

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
