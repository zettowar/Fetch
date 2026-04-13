import client from './client';
import type { Dog } from '../types';

export async function getFeed(limit = 10): Promise<Dog[]> {
  const res = await client.get('/feed/next', { params: { limit } });
  return res.data;
}
