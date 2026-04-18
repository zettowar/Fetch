import client from './client';

export interface RescuePublic {
  id: string;
  org_name: string;
  description: string;
  location: string | null;
  website: string | null;
  donation_url: string | null;
}

export interface RescueProfile extends RescuePublic {
  user_id: string;
  proof_details: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface RescueSignupPayload {
  email: string;
  password: string;
  org_name: string;
  description: string;
  location?: string;
  website?: string;
  donation_url?: string;
  proof_details?: string;
}

export async function signupRescue(data: RescueSignupPayload) {
  const res = await client.post('/auth/signup-rescue', data);
  return res.data as {
    tokens: { access_token: string; refresh_token: string };
    user: { id: string; email: string; display_name: string; role: string };
    rescue_profile: { id: string; status: string; org_name: string };
  };
}

export async function listRescues(q?: string): Promise<RescuePublic[]> {
  const res = await client.get('/rescues', { params: { q: q || undefined } });
  return res.data;
}

export async function getRescue(id: string): Promise<RescuePublic> {
  const res = await client.get(`/rescues/${id}`);
  return res.data;
}

export async function getRescueDogs(id: string, includeAdopted = false) {
  const res = await client.get(`/rescues/${id}/dogs`, {
    params: { include_adopted: includeAdopted },
  });
  return res.data;
}

export async function getMyRescueProfile(): Promise<RescueProfile> {
  const res = await client.get('/rescues/me');
  return res.data;
}

export async function updateMyRescueProfile(
  data: Partial<Pick<RescueProfile, 'org_name' | 'description' | 'location' | 'website' | 'donation_url'>>,
): Promise<RescueProfile> {
  const res = await client.patch('/rescues/me', data);
  return res.data;
}

// --- Adoption actions ---

export async function markDogAdopted(dogId: string) {
  const res = await client.post(`/rescues/dogs/${dogId}/mark-adopted`);
  return res.data;
}

export async function transferDog(
  dogId: string,
  payload: { target_user_id?: string; invited_email?: string },
) {
  const res = await client.post(`/rescues/dogs/${dogId}/transfer`, payload);
  return res.data;
}

// --- Admin ---

export async function adminListRescueProfiles(
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
): Promise<RescueProfile[]> {
  const res = await client.get('/admin/rescue-profiles', {
    params: { status_filter: status, limit: 100 },
  });
  return res.data;
}

export async function adminReviewRescueProfile(
  id: string,
  approve: boolean,
  note?: string,
): Promise<RescueProfile> {
  const res = await client.post(`/admin/rescue-profiles/${id}/review`, {
    approve,
    note: note || null,
  });
  return res.data;
}
