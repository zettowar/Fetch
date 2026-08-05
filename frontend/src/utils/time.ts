import { API_BASE } from '../api/client';

export function photoUrl(photo: { url?: string | null; storage_key: string }): string {
  return photo.url || `${API_BASE}/photos/file/${photo.storage_key}`;
}

export function petHeroPhoto(pet: {
  primary_photo_url?: string | null;
  photos: Array<{ url?: string | null; storage_key: string; moderation_status?: string }>;
}): string | null {
  if (pet.primary_photo_url) return pet.primary_photo_url;
  // Owners get their in-review photos in `photos`, but the public file route
  // won't serve them — falling back to one would render a broken hero. Those
  // stay in the gallery (badged) until a reviewer clears them.
  const usable = pet.photos.find(
    (p) => !p.moderation_status || p.moderation_status === 'approved',
  );
  return usable ? photoUrl(usable) : null;
}

export function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function petAge(birthdayStr: string | null): string | null {
  if (!birthdayStr) return null;
  const birth = new Date(birthdayStr);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;

  if (totalMonths < 1) return 'Puppy';
  if (totalMonths < 12) return `${totalMonths} mo`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (m === 0) return `${y} yr${y > 1 ? 's' : ''}`;
  return `${y} yr${y > 1 ? 's' : ''} ${m} mo`;
}
