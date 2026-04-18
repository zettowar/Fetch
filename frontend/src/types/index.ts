export interface User {
  id: string;
  email: string;
  display_name: string;
  location_rough: string | null;
  date_of_birth: string | null;
  is_verified: boolean;
  role: string;
  show_adoption_prompt: boolean;
  created_at: string;
}

export interface Photo {
  id: string;
  storage_key: string;
  url?: string;
  width: number;
  height: number;
  content_type: string;
  sort_order: number;
  created_at: string;
}

export type MixType = 'purebred' | 'cross' | 'mixed' | 'mystery_mutt';

export interface Breed {
  id: string;
  name: string;
  slug: string;
  group?: string | null;
  is_active?: boolean;
}

export interface Dog {
  id: string;
  owner_id: string;
  name: string;
  mix_type: MixType;
  breeds: Breed[];
  breed_display: string;
  birthday: string | null;
  bio: string | null;
  location_rough: string | null;
  traits: string[];
  primary_photo_id: string | null;
  primary_photo_url: string | null;
  is_active: boolean;
  created_at: string;
  photos: Photo[];
  adoptable: boolean;
  adopted_at: string | null;
  rescue_name: string | null;
  rescue_id: string | null;
}

export interface Vote {
  id: string;
  voter_id: string;
  dog_id: string;
  value: number;
  week_bucket: string;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  dog_id: string;
  dog_name: string;
  breed: string | null; // display string (joined breed names / mix_type label)
  score: number;
  total_votes: number;
}

export interface WeeklyWinner {
  id: string;
  week_bucket: string;
  dog_id: string;
  dog_name: string | null;
  breed: string | null; // display string
  score: number;
  primary_photo_url: string | null;
  created_at: string;
}

export interface DogStats {
  likes: number;
  passes: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse {
  tokens: TokenResponse;
  user: User;
}
