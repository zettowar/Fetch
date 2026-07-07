import client from './client';
import type { Breed, Species } from '../types';

export async function listBreeds(q?: string, species?: Species): Promise<Breed[]> {
  const res = await client.get('/breeds', { params: { q: q || undefined, species } });
  return res.data;
}

export interface AdminBreed extends Breed {
  pet_count: number;
  created_at: string;
}

export async function adminListBreeds(params: {
  q?: string;
  include_inactive?: boolean;
  offset?: number;
  limit?: number;
}): Promise<{ items: AdminBreed[]; total: number }> {
  const res = await client.get('/admin/breeds', { params });
  const total = Number(res.headers['x-total-count'] ?? res.data.length);
  return { items: res.data, total };
}

export async function adminCreateBreed(data: {
  name: string;
  group?: string | null;
  species?: Species;
  is_active?: boolean;
}): Promise<AdminBreed> {
  const res = await client.post('/admin/breeds', data);
  return res.data;
}

export async function adminUpdateBreed(
  id: string,
  data: Partial<{ name: string; group: string | null; is_active: boolean }>,
): Promise<AdminBreed> {
  const res = await client.patch(`/admin/breeds/${id}`, data);
  return res.data;
}

export async function adminDeleteBreed(id: string): Promise<void> {
  await client.delete(`/admin/breeds/${id}`);
}
