import client from './client';
import type { Pet, Species } from '../types';

export async function getFeed(limit = 10, species?: Species): Promise<Pet[]> {
  const params: Record<string, string | number> = { limit };
  if (species) params.species = species;
  const res = await client.get('/feed/next', { params });
  return res.data;
}
