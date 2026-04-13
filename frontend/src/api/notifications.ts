import client from './client';

export interface NotificationPrefs {
  lost_dog_alerts: boolean;
  weekly_winner: boolean;
  comments_on_dogs: boolean;
  new_followers: boolean;
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
