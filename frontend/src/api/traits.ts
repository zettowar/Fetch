import client from './client';
import type { Species } from '../types';

// Personality traits are free-form: these endpoints serve the *suggested*
// chips from the admin-managed `pet_traits` vocabulary. Anything an owner
// types is accepted on their pet and queued for review before it becomes a
// suggestion for everyone — see backend/app/services/traits.py.

export const MAX_TRAITS_PER_PET = 12;
export const MAX_TRAIT_LENGTH = 30;

export type TraitSpecies = Species | 'both';
export type TraitStatus = 'approved' | 'pending' | 'rejected';

export interface TraitOption {
  label: string;
  slug: string;
  species: TraitSpecies;
}

export async function getTraitOptions(species: Species): Promise<TraitOption[]> {
  const res = await client.get('/pets/traits', { params: { species } });
  return res.data;
}

/** Mirrors backend normalize_trait — same rules, same messages, so the owner
 *  hears about a bad trait before the request rather than after it. */
export function validateTrait(raw: string): string | null {
  const label = raw.trim().replace(/\s+/g, ' ');
  if (!label) return 'Trait cannot be empty';
  if (label.length > MAX_TRAIT_LENGTH) {
    return `Traits must be ${MAX_TRAIT_LENGTH} characters or less`;
  }
  if (!/[\p{L}\p{N}]/u.test(label)) return 'Traits need at least one letter or number';
  const bad = [...label].find(
    (ch) => !/[\p{L}\p{N}]/u.test(ch) && !" '-&+/".includes(ch),
  );
  if (bad) return `Traits can't contain "${bad}"`;
  return null;
}

/** Sentence-cases a trait the way the backend will store it. */
export function normalizeTrait(raw: string): string {
  const label = raw.trim().replace(/\s+/g, ' ');
  return label ? label[0].toUpperCase() + label.slice(1) : label;
}

export interface AdminTrait {
  id: string;
  label: string;
  slug: string;
  species: TraitSpecies;
  status: TraitStatus;
  sort_order: number;
  pet_count: number;
  created_by_name: string | null;
  created_at: string;
}

export async function adminListTraits(params: {
  q?: string;
  status?: TraitStatus;
  offset?: number;
  limit?: number;
}): Promise<{ items: AdminTrait[]; total: number }> {
  const res = await client.get('/admin/pet-traits', { params });
  const total = Number(res.headers['x-total-count'] ?? res.data.length);
  return { items: res.data, total };
}

export async function adminCreateTrait(data: {
  label: string;
  species?: TraitSpecies;
  status?: TraitStatus;
  sort_order?: number;
}): Promise<AdminTrait> {
  const res = await client.post('/admin/pet-traits', data);
  return res.data;
}

export async function adminUpdateTrait(
  id: string,
  data: Partial<{
    label: string;
    species: TraitSpecies;
    status: TraitStatus;
    sort_order: number;
  }>,
): Promise<AdminTrait> {
  const res = await client.patch(`/admin/pet-traits/${id}`, data);
  return res.data;
}

export async function adminDeleteTrait(
  id: string,
): Promise<{ detail: string; pets_stripped: number }> {
  const res = await client.delete(`/admin/pet-traits/${id}`);
  return res.data;
}
