import { useQuery } from '@tanstack/react-query';
import { getOwnPhotoBlob } from '../api/photos';
import { photoUrl } from '../utils/time';
import type { Photo } from '../types';
import Badge from './ui/Badge';
import { photoIn } from '../utils/photoIn';

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
    return <div className={`${className} shimmer`} />;
  }
  return <img ref={photoIn} src={src} alt={alt} className={`photo-in ${className}`} {...imgProps} />;
}

/**
 * Corner badge marking a photo as awaiting moderation: the dashed `review`
 * badge, on a solid backing so it still reads over any photo.
 */
export function InReviewBadge({ className = '' }: { className?: string }) {
  return (
    <Badge
      variant="review"
      title="Only you can see this until it's reviewed"
      className={`pointer-events-none !bg-white/95 dark:!bg-night/90 ${className}`}
    >
      In review
    </Badge>
  );
}
