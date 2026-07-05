import client from './client';

export interface MyInviteCode {
  id: string;
  code: string;
  is_used: boolean;
  created_at: string;
}

export async function getMyInvites(): Promise<MyInviteCode[]> {
  const res = await client.get('/invites/mine');
  return res.data;
}

export async function generateMyInvites(): Promise<MyInviteCode[]> {
  const res = await client.post('/invites/mine/generate');
  return res.data;
}
