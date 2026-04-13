import client from './client';
import type { Vote } from '../types';

export async function castVote(dog_id: string, value: 1 | -1): Promise<Vote> {
  const res = await client.post('/votes', { dog_id, value });
  return res.data;
}
