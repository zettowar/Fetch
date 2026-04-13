import client from './client';
import type { DogStats, LeaderboardEntry, WeeklyWinner } from '../types';

export async function getCurrentRankings(): Promise<LeaderboardEntry[]> {
  const res = await client.get('/rankings/current');
  return res.data;
}

export async function getCurrentWinner(): Promise<WeeklyWinner | null> {
  const res = await client.get('/rankings/winner/current');
  return res.data;
}

export async function getWinnerHistory(limit = 12): Promise<WeeklyWinner[]> {
  const res = await client.get('/rankings/history', { params: { limit } });
  return res.data;
}

export async function getDogStats(dogId: string): Promise<DogStats> {
  const res = await client.get(`/rankings/dogs/${dogId}/stats`);
  return res.data;
}
