import client from './client';
import type { Pet, MixType, Species } from '../types';

// Personality traits live in ./traits.ts — they're free-form and
// admin-curated rather than a constant.

export const MIX_TYPES: { value: MixType; label: string; hint: string }[] = [
  { value: 'purebred', label: 'Purebred', hint: 'A single recognized breed' },
  { value: 'cross', label: 'Cross', hint: 'Two known parent breeds' },
  { value: 'mixed', label: 'Mixed breed', hint: 'Multiple suspected breeds' },
  { value: 'mystery_mutt', label: 'Mystery mutt', hint: 'Pedigree unknown' },
];

export const MAX_BREEDS_PER_PET = 3;

export async function getMyPets(): Promise<Pet[]> {
  const res = await client.get('/pets/mine');
  return res.data;
}

export async function getPetsByUser(userId: string): Promise<Pet[]> {
  const res = await client.get(`/pets/by-user/${userId}`);
  return res.data;
}

export async function getPet(id: string): Promise<Pet> {
  const res = await client.get(`/pets/${id}`);
  return res.data;
}

export async function getExplorePets(
  limit = 24,
  excludeIds: string[] = [],
  species?: Species,
): Promise<Pet[]> {
  const params: Record<string, string | number> = { limit };
  if (excludeIds.length > 0) params.exclude = excludeIds.join(',');
  if (species) params.species = species;
  const res = await client.get('/pets/explore', { params });
  return res.data;
}

export interface PetPayload {
  name: string;
  species?: Species;
  mix_type?: MixType;
  breed_ids?: string[];
  birthday?: string;
  bio?: string;
  location_rough?: string;
  traits?: string[];
}

export async function createPet(data: PetPayload): Promise<Pet> {
  const res = await client.post('/pets', data);
  return res.data;
}

export async function updatePet(id: string, data: Partial<PetPayload>): Promise<Pet> {
  const res = await client.patch(`/pets/${id}`, data);
  return res.data;
}

export async function deletePet(id: string): Promise<void> {
  await client.delete(`/pets/${id}`);
}

export async function setPrimaryPhoto(petId: string, photoId: string): Promise<Pet> {
  const res = await client.post(`/pets/${petId}/primary-photo`, { photo_id: photoId });
  return res.data;
}
