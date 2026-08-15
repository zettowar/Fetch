import client from './client';

export interface NotificationPrefs {
  lost_dog_alerts: boolean;
  weekly_winner: boolean;
  comments_on_dogs: boolean;
  new_followers: boolean;
  // Email-only consents. The one-click unsubscribe links in those emails write
  // these, so they must be togglable back on here — otherwise opting out is a
  // one-way door.
  announcement_emails: boolean;
  weekly_recap: boolean;
  digest_mode: 'off' | 'daily' | 'weekly';
}

export async function getPreferences(): Promise<NotificationPrefs> {
  const res = await client.get('/notifications/preferences');
  return res.data;
}

export async function updatePreferences(data: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  const res = await client.patch('/notifications/preferences', data);
  return res.data;
}

// --- Inbox ---

export interface InboxNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export async function getInbox(params: { limit?: number; offset?: number } = {}): Promise<InboxNotification[]> {
  const res = await client.get('/notifications/inbox', { params });
  return res.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await client.get('/notifications/inbox/unread-count');
  return res.data.count;
}

export async function markRead(id: string): Promise<InboxNotification> {
  const res = await client.post(`/notifications/inbox/${id}/read`);
  return res.data;
}

export async function markAllRead(): Promise<void> {
  await client.post('/notifications/inbox/read-all');
}
