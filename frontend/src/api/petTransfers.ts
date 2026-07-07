import client from './client';

export interface DogTransfer {
  id: string;
  pet_id: string;
  pet_name: string | null;
  pet_photo_url: string | null;
  from_user_id: string;
  from_rescue_name: string | null;
  to_user_id: string | null;
  invited_email: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  expires_at: string;
  responded_at: string | null;
  created_at: string;
}

export async function listMyTransfers(): Promise<DogTransfer[]> {
  const res = await client.get('/pet-transfers/mine');
  return res.data;
}

export async function acceptTransfer(id: string): Promise<DogTransfer> {
  const res = await client.post(`/pet-transfers/${id}/accept`);
  return res.data;
}

export async function declineTransfer(id: string): Promise<DogTransfer> {
  const res = await client.post(`/pet-transfers/${id}/decline`);
  return res.data;
}
