import client from './client';
import type { PublicDog } from './publicSite';

export interface OwnerTag {
  code: string;
  pet_id: string | null;
  pet_name: string | null;
  assigned_at: string | null;
}

export interface PublicTag {
  assigned: boolean;
  pet: PublicDog | null;
}

// --- Public scan ---
export async function getPublicTag(code: string): Promise<PublicTag> {
  return (await client.get(`/public/tags/${code}`)).data;
}

// --- Owner ---
export async function claimTag(code: string, petId: string): Promise<OwnerTag> {
  return (await client.post('/tags/claim', { code, pet_id: petId })).data;
}

export async function getTagsForPet(petId: string): Promise<OwnerTag[]> {
  return (await client.get(`/tags/by-pet/${petId}`)).data;
}

export async function unlinkTag(code: string): Promise<{ detail: string }> {
  return (await client.delete(`/tags/${code}`)).data;
}

// --- Admin ---
export interface AdminTag {
  code: string;
  pet_id: string | null;
  pet_name: string | null;
  owner_email: string | null;
  assigned_at: string | null;
  created_at: string;
}

export async function generateTags(count: number): Promise<string[]> {
  return (await client.post('/admin/tags/generate', { count })).data.codes;
}

export async function listAdminTags(
  params: { assigned?: boolean; q?: string; offset?: number; limit?: number } = {},
): Promise<{ items: AdminTag[]; total: number }> {
  const res = await client.get('/admin/tags', { params });
  const raw = (res.headers as { get?: (k: string) => string | null })?.get?.('x-total-count');
  const total = raw ? parseInt(raw, 10) : res.data.length;
  return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
}

export async function adminAssignTag(code: string, petId: string): Promise<AdminTag> {
  return (await client.post(`/admin/tags/${code}/assign`, { pet_id: petId })).data;
}
