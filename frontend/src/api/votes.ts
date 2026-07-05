import client from './client';
import type { Dog, Vote } from '../types';

export async function castVote(dog_id: string, value: 1 | -1): Promise<Vote> {
  const res = await client.post('/votes', { dog_id, value });
  return res.data;
}

export async function getLikedDogs(params: { limit?: number; offset?: number } = {}): Promise<Dog[]> {
  const res = await client.get('/votes/liked', { params });
  return res.data;
}
