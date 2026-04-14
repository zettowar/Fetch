import client from './client';
import type { Dog } from '../types';

// Keep in sync with backend/app/schemas/dog.py VALID_TRAITS
export const DOG_TRAITS = [
  'Playful', 'Calm', 'Energetic', 'Good with kids', 'Good with dogs',
  'Loves fetch', 'Couch potato', 'Swimmer', 'Cuddly', 'Independent', 'Senior',
] as const;

export async function getMyDogs(): Promise<Dog[]> {
  const res = await client.get('/dogs/mine');
  return res.data;
}

export async function getDog(id: string): Promise<Dog> {
  const res = await client.get(`/dogs/${id}`);
  return res.data;
}

export async function createDog(data: {
  name: string;
  breed?: string;
  birthday?: string;
  bio?: string;
  location_rough?: string;
  traits?: string[];
}): Promise<Dog> {
  const res = await client.post('/dogs', data);
  return res.data;
}

export async function updateDog(
  id: string,
  data: Partial<{ name: string; breed: string; birthday: string; bio: string; location_rough: string; traits: string[] }>,
): Promise<Dog> {
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
