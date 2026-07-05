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
  dog_id: string;
  dog_name: string;
  week_bucket: string;
  score: number;
  photo_url: string | null;
}

export async function getPublicDog(dogId: string): Promise<PublicDog> {
  const res = await client.get(`/public/dogs/${dogId}`);
  return res.data;
}

export async function getPublicTopDog(): Promise<PublicTopDog | null> {
  const res = await client.get('/public/top-dog');
  return res.data;
}
