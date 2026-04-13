import client from './client';

export interface LostReportPhoto {
  id: string;
  storage_key: string;
  url?: string;
  width: number;
  height: number;
  content_type: string;
  created_at: string;
}

export interface LostReport {
  id: string;
  reporter_id: string;
  dog_id: string | null;
  kind: 'missing' | 'found';
  status: 'open' | 'resolved' | 'closed';
  last_seen_at: string | null;
  last_seen_lat: number | null;
  last_seen_lng: number | null;
  description: string;
  contact_method: string;
  resolved_at: string | null;
  created_at: string;
  photos: LostReportPhoto[];
  sighting_count: number;
  dog_name: string | null;
  dog_breed: string | null;
  dog_photo_url: string | null;
}

export interface NearbyReport {
  id: string;
  kind: 'missing' | 'found';
  status: string;
  fuzzed_lat: number;
  fuzzed_lng: number;
  dog_name: string | null;
  dog_breed: string | null;
  dog_photo_url: string | null;
  description: string;
  created_at: string;
}

export interface Sighting {
  id: string;
  report_id: string;
  reporter_id: string;
  lat: number;
  lng: number;
  seen_at: string | null;
  note: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  home_lat: number;
  home_lng: number;
  radius_km: number;
  enabled: boolean;
  created_at: string;
}

// --- Reports ---

export async function createLostReport(data: {
  dog_id?: string;
  kind: 'missing' | 'found';
  last_seen_at?: string;
  last_seen_lat?: number;
  last_seen_lng?: number;
  description: string;
  contact_method?: string;
  contact_value?: string;
}): Promise<LostReport> {
  const res = await client.post('/lost/reports', data);
  return res.data;
}

export async function getLostReport(id: string): Promise<LostReport> {
  const res = await client.get(`/lost/reports/${id}`);
  return res.data;
}

export async function updateLostReport(
  id: string,
  data: Partial<{ status: string; description: string }>,
): Promise<LostReport> {
  const res = await client.patch(`/lost/reports/${id}`, data);
  return res.data;
}

export async function resolveLostReport(id: string): Promise<LostReport> {
  const res = await client.post(`/lost/reports/${id}/resolve`);
  return res.data;
}

export async function getNearbyReports(
  lat: number,
  lng: number,
  radius_km = 10,
  kind?: string,
): Promise<NearbyReport[]> {
  const params: Record<string, unknown> = { lat, lng, radius_km };
  if (kind) params.kind = kind;
  const res = await client.get('/lost/reports/nearby', { params });
  return res.data;
}

// --- Sightings ---

export async function addSighting(
  reportId: string,
  data: { lat: number; lng: number; seen_at?: string; note?: string },
): Promise<Sighting> {
  const res = await client.post(`/lost/reports/${reportId}/sightings`, data);
  return res.data;
}

export async function getSightings(reportId: string): Promise<Sighting[]> {
  const res = await client.get(`/lost/reports/${reportId}/sightings`);
  return res.data;
}

// --- Subscriptions ---

export async function createSubscription(data: {
  home_lat: number;
  home_lng: number;
  radius_km?: number;
}): Promise<Subscription> {
  const res = await client.post('/lost/subscriptions', data);
  return res.data;
}

export async function getMySubscription(): Promise<Subscription | null> {
  const res = await client.get('/lost/subscriptions/mine');
  return res.data;
}

export async function updateSubscription(
  data: Partial<{ home_lat: number; home_lng: number; radius_km: number; enabled: boolean }>,
): Promise<Subscription> {
  const res = await client.patch('/lost/subscriptions/mine', data);
  return res.data;
}

// --- Contact ---

export async function contactReporter(reportId: string, message: string) {
  const res = await client.post(`/lost/reports/${reportId}/contact`, { message });
  return res.data;
}
