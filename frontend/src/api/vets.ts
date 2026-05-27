import client from './client';

export interface Vet {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  hours: string | null;
  verified: boolean;
  attributes: Record<string, boolean> | null;
  created_at: string;
}

export async function getNearbyVets(
  lat: number,
  lng: number,
  radius_km = 15,
): Promise<Vet[]> {
  const res = await client.get('/vets/nearby', { params: { lat, lng, radius_km } });
  return res.data;
}

export async function getVet(id: string): Promise<Vet> {
  const res = await client.get(`/vets/${id}`);
  return res.data;
}

export async function createVet(data: {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  website?: string;
  hours?: string;
  attributes?: Record<string, boolean>;
}): Promise<Vet> {
  const res = await client.post('/vets', data);
  return res.data;
}

export async function updateVet(
  id: string,
  data: Partial<Pick<Vet, 'name' | 'address' | 'phone' | 'website' | 'hours' | 'attributes' | 'verified'>>,
): Promise<Vet> {
  const res = await client.patch(`/vets/${id}`, data);
  return res.data;
}
