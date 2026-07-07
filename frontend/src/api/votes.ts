import client from './client';
import type { Pet, Vote } from '../types';

export async function castVote(pet_id: string, value: 1 | -1): Promise<Vote> {
  const res = await client.post('/votes', { pet_id, value });
  return res.data;
}

export async function getLikedPets(params: { limit?: number; offset?: number } = {}): Promise<Pet[]> {
  const res = await client.get('/votes/liked', { params });
  return res.data;
}
