import client from './client';

export interface Rescue {
  id: string;
  name: string;
  description: string;
  location: string | null;
  website: string | null;
  donation_url: string | null;
  verified: boolean;
  featured_until: string | null;
  submitted_by: string | null;
  created_at: string;
}

export async function listRescues(): Promise<Rescue[]> {
  const res = await client.get('/rescues', { params: { verified_only: true } });
  return res.data;
}

export async function getMyRescues(): Promise<Rescue[]> {
  const res = await client.get('/rescues/mine');
  return res.data;
}

export async function submitRescue(data: {
  name: string;
  description: string;
  location?: string;
  website?: string;
  donation_url?: string;
}): Promise<Rescue> {
  const res = await client.post('/rescues', data);
  return res.data;
}
