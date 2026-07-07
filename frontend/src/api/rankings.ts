import client from './client';
import type { PetStats, LeaderboardEntry, WeeklyWinner, Species } from '../types';

export async function getCurrentRankings(species?: Species): Promise<LeaderboardEntry[]> {
  const res = await client.get('/rankings/current', { params: { species } });
  return res.data;
}

export async function getCurrentWinner(species?: Species): Promise<WeeklyWinner | null> {
  const res = await client.get('/rankings/winner/current', { params: { species } });
  return res.data;
}

export async function getWinnerHistory(limit = 12, species?: Species): Promise<WeeklyWinner[]> {
  const res = await client.get('/rankings/history', { params: { limit, species } });
  return res.data;
}

export async function getPetStats(petId: string): Promise<PetStats> {
  const res = await client.get(`/rankings/pets/${petId}/stats`);
  return res.data;
}
