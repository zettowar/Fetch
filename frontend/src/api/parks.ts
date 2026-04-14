import client from './client';

export interface Park {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  verified: boolean;
  attributes: Record<string, boolean> | null;
  avg_rating: number | null;
  review_count: number;
  active_dogs_count: number;
  created_at: string;
}

export interface ParkReview {
  id: string;
  park_id: string;
  author_id: string;
  author_name: string | null;
  rating: number;
  body: string | null;
  visit_time_of_day: string | null;
  crowd_level: string | null;
  created_at: string;
}

export interface ParkIncident {
  id: string;
  park_id: string;
  kind: string;
  description: string;
  expires_at: string;
  created_at: string;
}

export interface ParkCheckin {
  id: string;
  park_id: string;
  dog_id: string | null;
  dog_name: string | null;
  dog_breed: string | null;
  dog_photo_url: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
}

export async function getNearbyParks(lat: number, lng: number, radius_km = 10): Promise<Park[]> {
  const res = await client.get('/parks/nearby', { params: { lat, lng, radius_km } });
  return res.data;
}

export async function getPark(id: string): Promise<Park> {
  const res = await client.get(`/parks/${id}`);
  return res.data;
}

export async function createPark(data: { name: string; lat: number; lng: number; address?: string; attributes?: Record<string, boolean> }): Promise<Park> {
  const res = await client.post('/parks', data);
  return res.data;
}

export async function updatePark(id: string, data: { name?: string; address?: string; lat?: number; lng?: number; attributes?: Record<string, boolean> }): Promise<Park> {
  const res = await client.patch(`/parks/${id}`, data);
  return res.data;
}

export async function getParkReviews(parkId: string): Promise<ParkReview[]> {
  const res = await client.get(`/parks/${parkId}/reviews`);
  return res.data;
}

export async function createParkReview(parkId: string, data: { rating: number; body?: string; visit_time_of_day?: string; crowd_level?: string }): Promise<ParkReview> {
  const res = await client.post(`/parks/${parkId}/reviews`, data);
  return res.data;
}

export async function getParkIncidents(parkId: string): Promise<ParkIncident[]> {
  const res = await client.get(`/parks/${parkId}/incidents`);
  return res.data;
}

export async function createParkIncident(parkId: string, data: { kind: string; description: string }): Promise<ParkIncident> {
  const res = await client.post(`/parks/${parkId}/incidents`, data);
  return res.data;
}

export async function getParkCheckins(parkId: string): Promise<ParkCheckin[]> {
  const res = await client.get(`/parks/${parkId}/checkins`);
  return res.data;
}

export async function checkinPark(parkId: string, dogId: string): Promise<ParkCheckin> {
  const res = await client.post(`/parks/${parkId}/checkin`, { dog_id: dogId });
  return res.data;
}

export async function checkoutPark(parkId: string, dogId: string): Promise<void> {
  await client.delete(`/parks/${parkId}/checkin/${dogId}`);
}
