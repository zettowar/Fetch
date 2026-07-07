import client from './client';

export interface AdoptionInquiry {
  id: string;
  rescue_id: string;
  pet_id: string | null;
  inquirer_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: 'new' | 'contacted' | 'closed';
  created_at: string;
}

export interface AdoptionInquiryPayload {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  pet_id?: string | null;
}

export async function submitAdoptionInquiry(
  rescueId: string,
  payload: AdoptionInquiryPayload,
): Promise<AdoptionInquiry> {
  const res = await client.post(`/rescues/${rescueId}/inquiries`, payload);
  return res.data;
}

export async function listMyInquiries(): Promise<AdoptionInquiry[]> {
  const res = await client.get('/rescues/me/inquiries');
  return res.data;
}

export async function updateInquiryStatus(
  inquiryId: string,
  status: 'new' | 'contacted' | 'closed',
): Promise<AdoptionInquiry> {
  const res = await client.patch(`/rescues/me/inquiries/${inquiryId}`, { status });
  return res.data;
}
