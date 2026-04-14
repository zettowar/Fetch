import client from './client';

export interface PlayDateRsvp {
  id: string;
  playdate_id: string;
  user_id: string;
  dog_id: string;
  dog_name: string | null;
  dog_photo_url: string | null;
  status: 'going' | 'maybe' | 'declined';
  created_at: string;
}

export interface PlayDate {
  id: string;
  host_id: string;
  host_name: string | null;
  park_id: string;
  park_name: string | null;
  title: string | null;
  notes: string | null;
  scheduled_for: string;
  status: 'scheduled' | 'cancelled';
  rsvp_count: number;
  going_count: number;
  rsvps: PlayDateRsvp[];
  created_at: string;
}

export async function listUpcomingPlayDates(params: {
  parkId?: string;
  mine?: boolean;
  limit?: number;
}): Promise<PlayDate[]> {
  const res = await client.get('/playdates/upcoming', {
    params: {
      park_id: params.parkId,
      mine: params.mine,
      limit: params.limit,
    },
  });
  return res.data;
}

export async function getPlayDate(id: string): Promise<PlayDate> {
  const res = await client.get(`/playdates/${id}`);
  return res.data;
}

export async function createPlayDate(data: {
  park_id: string;
  scheduled_for: string;
  host_dog_id: string;
  title?: string;
  notes?: string;
}): Promise<PlayDate> {
  const res = await client.post('/playdates', data);
  return res.data;
}

export async function cancelPlayDate(id: string): Promise<void> {
  await client.delete(`/playdates/${id}`);
}

export async function rsvpPlayDate(
  id: string,
  dog_id: string,
  status: 'going' | 'maybe' | 'declined' = 'going',
): Promise<PlayDateRsvp> {
  const res = await client.post(`/playdates/${id}/rsvp`, { dog_id, status });
  return res.data;
}

export async function removeRsvp(id: string, dog_id: string): Promise<void> {
  await client.delete(`/playdates/${id}/rsvp/${dog_id}`);
}
