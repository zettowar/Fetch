import client from './client';
import type { Dog, MixType } from '../types';

// Keep in sync with backend/app/schemas/dog.py VALID_TRAITS
export const DOG_TRAITS = [
  'Playful', 'Calm', 'Energetic', 'Good with kids', 'Good with dogs',
  'Loves fetch', 'Couch potato', 'Swimmer', 'Cuddly', 'Independent', 'Senior',
] as const;

export const MIX_TYPES: { value: MixType; label: string; hint: string }[] = [
  { value: 'purebred', label: 'Purebred', hint: 'A single recognized breed' },
  { value: 'cross', label: 'Cross', hint: 'Two known parent breeds' },
  { value: 'mixed', label: 'Mixed breed', hint: 'Multiple suspected breeds' },
  { value: 'mystery_mutt', label: 'Mystery mutt', hint: 'Pedigree unknown' },
];

export const MAX_BREEDS_PER_DOG = 3;

export async function getMyDogs(): Promise<Dog[]> {
  const res = await client.get('/dogs/mine');
  return res.data;
}

export async function getDog(id: string): Promise<Dog> {
  const res = await client.get(`/dogs/${id}`);
  return res.data;
}

export interface DogPayload {
  name: string;
  mix_type?: MixType;
  breed_ids?: string[];
  birthday?: string;
  bio?: string;
  location_rough?: string;
  traits?: string[];
}

export async function createDog(data: DogPayload): Promise<Dog> {
  const res = await client.post('/dogs', data);
  return res.data;
}

export async function updateDog(id: string, data: Partial<DogPayload>): Promise<Dog> {
  const res = await client.patch(`/dogs/${id}`, data);
  return res.data;
}

export async function deleteDog(id: string): Promise<void> {
  await client.delete(`/dogs/${id}`);
}

export async function setPrimaryPhoto(dogId: string, photoId: string): Promise<Dog> {
  const res = await client.post(`/dogs/${dogId}/primary-photo`, { photo_id: photoId });
  return res.data;
}
