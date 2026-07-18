import client from './client';

// Read-only data for the public share pages. The shared axios client only
// attaches an auth header when a session exists, so these work logged out.

export interface PublicDog {
  id: string;
  name: string;
  species: 'dog' | 'cat';
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

export interface PublicNewsPost {
  id: string;
  title: string;
  body: string;
  tag: string;
  link_url: string | null;
  link_label: string | null;
  published_at: string | null;
}

export async function getPublicNews(): Promise<PublicNewsPost[]> {
  const res = await client.get('/public/news');
  return res.data;
}

export async function getPublicDog(petId: string): Promise<PublicDog> {
  const res = await client.get(`/public/pets/${petId}`);
  return res.data;
}

export async function getPublicTopDog(): Promise<PublicTopDog | null> {
  const res = await client.get('/public/top-pet');
  return res.data;
}

export interface PublicRescue {
  id: string;
  slug: string | null;
  org_name: string;
  description: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  donation_url: string | null;
  donations_enabled: boolean;
  logo_url: string | null;
  cover_url: string | null;
  pets: PublicDog[];
}

export async function getPublicRescue(slug: string): Promise<PublicRescue> {
  const res = await client.get(`/public/rescues/${slug}`);
  return res.data;
}

// Client-facing UI feature flags (Explore section gating). Unauthenticated.
export interface PublicFlags {
  explore_enabled: boolean;
  explore_parks_enabled: boolean;
  explore_pack_enabled: boolean;
  explore_donate_enabled: boolean;
  explore_shop_enabled: boolean;
  explore_vets_enabled: boolean;
}

export async function getPublicFlags(): Promise<PublicFlags> {
  const res = await client.get('/public/flags');
  return res.data;
}
