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
  total_pets: number;
  pending_reports: number;
  open_tickets: number;
  unverified_rescues: number;
  unused_invites: number;
  total_feedback: number;
  reports_last_7d: number;
  oldest_pending_report_hours: number | null;
  oldest_open_ticket_hours: number | null;
  donations_total_cents: number;
  donations_last_7d_cents: number;
  open_inquiries: number;
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
  pet_count: number;
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
  assigned_to: string | null;
  admin_notes: string | null;
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

export interface DeleteUserResult {
  detail: string;
  pets_deleted: number;
  photos_purged: number;
}

// Permanent, irreversible. Backend blocks deleting yourself or another admin.
export const deleteUser = async (id: string): Promise<DeleteUserResult> =>
  (await client.delete(`/admin/users/${id}`)).data;

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

export const searchTickets = async (
  params: { status?: string; q?: string; offset?: number; limit?: number } = {},
): Promise<Paginated<SupportTicket>> => {
  const res = await client.get('/support/tickets', {
    params: {
      status_filter: params.status ?? 'open',
      q: params.q,
      offset: params.offset,
      limit: params.limit,
    },
  });
  return { items: res.data, total: readTotal(res.headers, res.data.length) };
};

export const updateTicket = async (id: string, data: { status: string; admin_notes?: string }) =>
  (await client.post(`/admin/tickets/${id}/update`, data)).data;

export const getFeedback = async (): Promise<FeedbackEntry[]> =>
  (await client.get('/feedback')).data;

export const searchFeedback = async (
  params: { q?: string; offset?: number; limit?: number } = {},
): Promise<Paginated<FeedbackEntry>> => {
  const res = await client.get('/feedback', { params });
  return { items: res.data, total: readTotal(res.headers, res.data.length) };
};

export const getInvites = async (): Promise<InviteCode[]> =>
  (await client.get('/invites')).data;

export const generateInvites = async (count: number): Promise<InviteCode[]> =>
  (await client.post('/invites/generate', { count })).data;

export interface WaitlistEntry {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
  invited_at: string | null;
  invite_code: string | null;
}

export interface WaitlistInvite {
  email: string;
  code: string;
  signup_url: string;
  email_sent: boolean;
}

export const getWaitlist = async (): Promise<Paginated<WaitlistEntry>> => {
  const res = await client.get('/waitlist');
  return { items: res.data, total: readTotal(res.headers, res.data.length) };
};

export const inviteWaitlistEntry = async (id: string): Promise<WaitlistInvite> =>
  (await client.post(`/waitlist/${id}/invite`)).data;

export const deleteWaitlistEntry = async (id: string) =>
  (await client.delete(`/waitlist/${id}`)).data;

export interface NewsPost {
  id: string;
  title: string;
  body: string;
  tag: string;
  link_url: string | null;
  link_label: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

export interface NewsPostInput {
  title: string;
  body: string;
  tag: string;
  link_url?: string | null;
  link_label?: string | null;
  is_published?: boolean;
}

export const getAdminNews = async (): Promise<NewsPost[]> =>
  (await client.get('/admin/news')).data;

export const createNewsPost = async (data: NewsPostInput): Promise<NewsPost> =>
  (await client.post('/admin/news', data)).data;

export const updateNewsPost = async (id: string, data: Partial<NewsPostInput>): Promise<NewsPost> =>
  (await client.patch(`/admin/news/${id}`, data)).data;

export const deleteNewsPost = async (id: string) =>
  (await client.delete(`/admin/news/${id}`)).data;

export const createFAQ = async (data: { question: string; answer: string; category: string; sort_order?: number }): Promise<FAQEntry> =>
  (await client.post('/admin/faq', data)).data;

export const updateFAQ = async (id: string, data: Partial<{ question: string; answer: string; category: string; sort_order: number }>) =>
  (await client.patch(`/admin/faq/${id}`, data)).data;

export const deleteFAQ = async (id: string) =>
  (await client.delete(`/admin/faq/${id}`)).data;

export const grantEntitlement = async (data: { user_id: string; entitlement_key: string; source?: string }) =>
  (await client.post('/billing/grant', data)).data;

export const revokeEntitlement = async (userId: string, entitlementKey = 'ads_removed') =>
  (await client.delete(`/billing/grant/${userId}/${entitlementKey}`)).data;

export const getUserEntitlements = async (userId: string) =>
  (await client.get(`/admin/users/${userId}/entitlements`)).data as Array<{
    id: string;
    entitlement_key: string;
    source: string;
    expires_at: string | null;
    created_at: string;
  }>;

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

// --- Content moderation: pets ---

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
  const res = await client.get('/admin/pets', { params });
  return { items: res.data, total: readTotal(res.headers, res.data.length) };
};

export const deactivateDog = async (id: string) =>
  (await client.post(`/admin/pets/${id}/deactivate`)).data;

export const reactivateDog = async (id: string) =>
  (await client.post(`/admin/pets/${id}/reactivate`)).data;

// --- Flagged photo review queue ---

export interface FlaggedPhoto {
  id: string;
  pet_id: string;
  pet_name: string | null;
  owner_id: string | null;
  owner_email: string | null;
  content_type: string;
  moderation_status: string;
  created_at: string;
}

export const getFlaggedPhotos = async (): Promise<FlaggedPhoto[]> =>
  (await client.get('/admin/photos/flagged')).data;

// Flagged files are withheld by the public endpoint, so the reviewer image is
// fetched through the authenticated admin route as a blob.
export const getFlaggedPhotoBlob = async (id: string): Promise<Blob> =>
  (await client.get(`/admin/photos/${id}/file`, { responseType: 'blob' })).data;

export const approvePhoto = async (id: string) =>
  (await client.post(`/admin/photos/${id}/approve`)).data;

export const rejectPhoto = async (id: string) =>
  (await client.post(`/admin/photos/${id}/reject`)).data;

// --- Lost reports (admin) ---

export interface AdminLostReport {
  id: string;
  kind: string;
  status: string;
  description: string;
  reporter_id: string;
  reporter_name: string | null;
  pet_id: string | null;
  pet_name: string | null;
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

// --- User roles + account actions ---

export const setUserRole = async (id: string, role: 'user' | 'moderator' | 'admin') =>
  (await client.post(`/admin/users/${id}/set-role`, null, { params: { role } })).data;

export const editUser = async (id: string, data: { display_name?: string; email?: string }) =>
  (await client.patch(`/admin/users/${id}`, data)).data;

export const resendVerification = async (id: string) =>
  (await client.post(`/admin/users/${id}/resend-verification`)).data as { detail: string };

export const sendPasswordReset = async (id: string) =>
  (await client.post(`/admin/users/${id}/send-password-reset`)).data as { detail: string };

export const markVerified = async (id: string) =>
  (await client.post(`/admin/users/${id}/mark-verified`)).data;

export interface ImpersonateResult {
  access_token: string;
  token_type: string;
  user_id: string;
  display_name: string;
}
export const impersonateUser = async (id: string): Promise<ImpersonateResult> =>
  (await client.post(`/admin/users/${id}/impersonate`)).data;

// --- Rescue oversight ---

export const setRescueStatus = async (id: string, data: { status: string; note?: string }) =>
  (await client.post(`/admin/rescue-profiles/${id}/set-status`, data)).data;

export const editRescue = async (
  id: string,
  data: Partial<{ org_name: string; description: string; location: string; website: string; donation_url: string }>,
) => (await client.patch(`/admin/rescue-profiles/${id}`, data)).data;

export interface AdoptionInquiry {
  id: string;
  rescue_id: string;
  rescue_name: string | null;
  pet_id: string | null;
  inquirer_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: string;
  created_at: string;
}
export const getAdoptionInquiries = async (
  params: { rescue_id?: string; status?: string; offset?: number; limit?: number } = {},
): Promise<Paginated<AdoptionInquiry>> => {
  const res = await client.get('/admin/adoption-inquiries', {
    params: { rescue_id: params.rescue_id, status: params.status, offset: params.offset, limit: params.limit },
  });
  return { items: res.data, total: readTotal(res.headers, res.data.length) };
};

// --- Donations ---

export interface AdminDonation {
  id: string;
  recipient_type: string;
  recipient_name: string;
  amount_cents: number;
  currency: string;
  application_fee_cents: number;
  status: string;
  message: string | null;
  created_at: string;
}
export interface DonationsPage {
  items: AdminDonation[];
  total: number;
  succeeded_count: number;
  succeeded_amount_cents: number;
  succeeded_fee_cents: number;
}
export const getDonations = async (
  params: { status?: string; offset?: number; limit?: number } = {},
): Promise<DonationsPage> =>
  (await client.get('/admin/donations', { params })).data;

export const refundDonation = async (id: string) =>
  (await client.post(`/admin/donations/${id}/refund`)).data as { detail: string; amount_cents: number };

// --- Announcements ---

export interface Announcement {
  id: string;
  title: string;
  body: string;
  link: string | null;
  segment: string;
  send_email: boolean;
  recipient_count: number;
  sent_by: string | null;
  created_at: string;
}
export const getAnnouncements = async (): Promise<Announcement[]> =>
  (await client.get('/admin/announcements')).data;

export const createAnnouncement = async (data: {
  title: string; body: string; link?: string; segment: string; send_email: boolean;
}): Promise<Announcement> =>
  (await client.post('/admin/announcements', data)).data;

// --- Settings / feature flags ---

export interface AppSetting {
  key: string;
  value: unknown;
  default: unknown;
  description: string;
  overridden: boolean;
}
export const getSettings = async (): Promise<AppSetting[]> =>
  (await client.get('/admin/settings')).data;

export const putSetting = async (key: string, value: unknown): Promise<AppSetting> =>
  (await client.put(`/admin/settings/${key}`, { value })).data;

// --- System / jobs ---

export interface SystemJobs {
  broker_queue_depth: number | null;
  registered_tasks: string[];
}
export const getSystemJobs = async (): Promise<SystemJobs> =>
  (await client.get('/admin/system/jobs')).data;

export interface TestEmailResult {
  delivered: boolean;
  detail: string;
  sent_from: string;
}

/** Email deliverability probe. Resolves (not rejects) when the send fails —
 *  `delivered: false` plus a reason is the useful diagnostic. */
export const sendTestEmail = async (email: string): Promise<TestEmailResult> =>
  (await client.post('/admin/system/test-email', { email })).data;

// --- Scheduled jobs (editable Celery Beat schedule) ---

export type ScheduleType = 'interval' | 'crontab';

export interface PeriodicTask {
  id: string;
  name: string;
  task: string;
  schedule_type: ScheduleType;
  interval_seconds: number | null;
  minute: string;
  hour: string;
  day_of_week: string;
  day_of_month: string;
  month_of_year: string;
  args: unknown[];
  kwargs: Record<string, unknown>;
  queue: string | null;
  enabled: boolean;
  one_off: boolean;
  last_run_at: string | null;
  total_run_count: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Computed server-side:
  registered: boolean;
  schedule_display: string;
}

export interface PeriodicTaskInput {
  name: string;
  task: string;
  schedule_type: ScheduleType;
  interval_seconds?: number | null;
  minute?: string;
  hour?: string;
  day_of_week?: string;
  day_of_month?: string;
  month_of_year?: string;
  args?: unknown[];
  kwargs?: Record<string, unknown>;
  queue?: string | null;
  enabled?: boolean;
  one_off?: boolean;
  description?: string | null;
}

export const listScheduledTasks = async (): Promise<PeriodicTask[]> =>
  (await client.get('/admin/scheduled-tasks')).data;

export const getAvailableTasks = async (): Promise<string[]> =>
  (await client.get('/admin/scheduled-tasks/available-tasks')).data;

export const createScheduledTask = async (data: PeriodicTaskInput): Promise<PeriodicTask> =>
  (await client.post('/admin/scheduled-tasks', data)).data;

export const updateScheduledTask = async (
  id: string,
  data: Partial<PeriodicTaskInput>,
): Promise<PeriodicTask> =>
  (await client.patch(`/admin/scheduled-tasks/${id}`, data)).data;

export const deleteScheduledTask = async (id: string) =>
  (await client.delete(`/admin/scheduled-tasks/${id}`)).data;

export const runScheduledTask = async (
  id: string,
): Promise<{ detail: string; task_id: string | null }> =>
  (await client.post(`/admin/scheduled-tasks/${id}/run`)).data;
