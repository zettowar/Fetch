import client from './client';

// Read-only data for the public share pages. The shared axios client only
// attaches an auth header when a session exists, so these work logged out.

export interface PublicDog {
  id: string;
  name: string;
  breed_display: string | null;
  birthday: string | null;
  bio: string | null;
  traits: string[];
  photo_urls: string[];
  primary_photo_url: string | null;
  adoptable: boolean;
  adopted: boolean;
  rescue_name: string | null;
  crown_weeks: string[];
}

export interface PublicTopDog {
  pet_id: string;
  pet_name: string;
  week_bucket: string;
  score: number;
  photo_url: string | null;
}

export async function getPublicDog(petId: string): Promise<PublicDog> {
  const res = await client.get(`/public/pets/${petId}`);
  return res.data;
}

export async function getPublicTopDog(): Promise<PublicTopDog | null> {
  const res = await client.get('/public/top-pet');
  return res.data;
}
