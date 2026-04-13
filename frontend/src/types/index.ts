export interface User {
  id: string;
  email: string;
  display_name: string;
  location_rough: string | null;
  date_of_birth: string | null;
  is_verified: boolean;
  role: string;
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

export interface Dog {
  id: string;
  owner_id: string;
  name: string;
  breed: string | null;
  birthday: string | null;
  bio: string | null;
  location_rough: string | null;
  traits: string[];
  primary_photo_id: string | null;
  primary_photo_url: string | null;
  is_active: boolean;
  created_at: string;
  photos: Photo[];
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
  breed: string | null;
  score: number;
  total_votes: number;
}

export interface WeeklyWinner {
  id: string;
  week_bucket: string;
  dog_id: string;
  dog_name: string | null;
  breed: string | null;
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
