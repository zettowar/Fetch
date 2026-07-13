import client from './client';
import type { User } from '../types';

export interface RescuePublic {
  id: string;
  slug: string | null;
  org_name: string;
  description: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  donation_url: string | null;
  donations_enabled: boolean; // Stripe Connect live → in-app donations
  logo_url: string | null;
  cover_url: string | null;
}

export interface RescueProfile extends RescuePublic {
  user_id: string;
  proof_details: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  is_public: boolean;
}

export interface RescueSignupPayload {
  email: string;
  password: string;
  org_name: string;
  description: string;
  location?: string;
  lat?: number;
  lng?: number;
  website?: string;
  donation_url?: string;
  proof_details?: string;
}

export async function signupRescue(data: RescueSignupPayload) {
  const res = await client.post('/auth/signup-rescue', data);
  return res.data as {
    tokens: { access_token: string; refresh_token: string };
    user: User;
    rescue_profile: { id: string; status: string; org_name: string };
  };
}

export async function listRescues(q?: string): Promise<RescuePublic[]> {
  const res = await client.get('/rescues', { params: { q: q || undefined } });
  return res.data;
}

export async function getNearbyRescues(
  lat: number,
  lng: number,
  radius_km = 50,
): Promise<RescuePublic[]> {
  const res = await client.get('/rescues/nearby', {
    params: { lat, lng, radius_km },
  });
  return res.data;
}

export async function getRescue(id: string): Promise<RescuePublic> {
  const res = await client.get(`/rescues/${id}`);
  return res.data;
}

export async function getRescueDogs(id: string, includeAdopted = false) {
  const res = await client.get(`/rescues/${id}/pets`, {
    params: { include_adopted: includeAdopted },
  });
  return res.data;
}

export async function getMyRescueProfile(): Promise<RescueProfile> {
  const res = await client.get('/rescues/me');
  return res.data;
}

export async function updateMyRescueProfile(
  data: Partial<Pick<RescueProfile, 'org_name' | 'description' | 'location' | 'lat' | 'lng' | 'website' | 'donation_url' | 'is_public'>>,
): Promise<RescueProfile> {
  const res = await client.patch('/rescues/me', data);
  return res.data;
}

async function uploadRescueImage(kind: 'logo' | 'cover', file: File): Promise<RescueProfile> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post(`/rescues/me/${kind}`, form);
  return res.data;
}

export const uploadRescueLogo = (file: File) => uploadRescueImage('logo', file);
export const uploadRescueCover = (file: File) => uploadRescueImage('cover', file);

// --- Adoption actions ---

export async function markDogAdopted(petId: string) {
  const res = await client.post(`/rescues/pets/${petId}/mark-adopted`);
  return res.data;
}

export async function transferDog(
  petId: string,
  payload: { target_user_id?: string; invited_email?: string },
) {
  const res = await client.post(`/rescues/pets/${petId}/transfer`, payload);
  return res.data;
}

// --- Admin ---

export async function adminListRescueProfiles(
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
  q = '',
): Promise<RescueProfile[]> {
  const res = await client.get('/admin/rescue-profiles', {
    params: { status_filter: status, q: q || undefined, limit: 100 },
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
