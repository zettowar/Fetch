import { useQuery } from '@tanstack/react-query';
import { getOwnPhotoBlob } from '../api/photos';
import { photoUrl } from '../utils/time';
import type { Photo } from '../types';

/**
 * Renders a pet photo, including the owner's own photos still in moderation.
 *
 * Those are withheld by the public file route (`/photos/file/{key}` 404s
 * anything not approved), so an `<img src>` built the usual way renders broken.
 * They only ever appear in the owner's own payloads, and they come back with no
 * `url` — we fetch those through the authenticated per-photo route and hand the
 * browser an object URL instead.
 */

type PhotoLike = Pick<Photo, 'id' | 'storage_key' | 'url' | 'moderation_status'>;

export function isInReview(photo: Pick<Photo, 'moderation_status'>): boolean {
  return !!photo.moderation_status && photo.moderation_status !== 'approved';
}

export function usePhotoSrc(photo: PhotoLike): string | undefined {
  const inReview = isInReview(photo);
  const { data: blobUrl } = useQuery({
    queryKey: ['own-photo-file', photo.id],
    queryFn: async () => URL.createObjectURL(await getOwnPhotoBlob(photo.id)),
    enabled: inReview,
    staleTime: Infinity,
  });
  return inReview ? blobUrl : photoUrl(photo);
}

interface PetPhotoProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  photo: PhotoLike;
  alt: string;
}

export default function PetPhoto({ photo, alt, className = '', ...imgProps }: PetPhotoProps) {
  const src = usePhotoSrc(photo);
  if (!src) {
    // In-review blob still loading — hold the layout rather than flash a broken
    // image (the public URL for this photo would 404).
    return <div className={`${className} bg-gray-100 dark:bg-gray-800 animate-pulse`} />;
  }
  return <img src={src} alt={alt} className={className} {...imgProps} />;
}

/** Corner badge marking a photo as awaiting moderation. */
export function InReviewBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Only you can see this until it's reviewed"
      className={`pointer-events-none rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white ${className}`}
    >
      In review
    </span>
  );
}
