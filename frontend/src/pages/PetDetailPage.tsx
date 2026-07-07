import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Camera, ChevronLeft, ChevronRight, Crown, Star, X } from 'lucide-react';
import { getPet, setPrimaryPhoto } from '../api/pets';
import { deletePhoto } from '../api/photos';
import { getNearbyParks, checkinPark } from '../api/parks';
import { getPetStats } from '../api/rankings';
import { getFollowerCount } from '../api/social';
import { useAuth } from '../store/AuthContext';
import FollowButton from '../components/FollowButton';
import ReactionBar from '../components/ReactionBar';
import CommentSection from '../components/CommentSection';
import PhotoUploader from '../components/PhotoUploader';
import BackButton from '../components/ui/BackButton';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import PetIllustration from '../components/flair/PetIllustration';
import { usePawBurst } from '../components/flair/PawBurst';
import Linkify from '../components/Linkify';
import TimeAgo from '../components/TimeAgo';
import { petAge, photoUrl, petHeroPhoto } from '../utils/time';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { shareLink } from '../utils/shareLink';
import { apiErrorMessage, isNotFound } from '../utils/apiError';

export default function PetDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

  const { data: pet, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pet', id],
    queryFn: () => getPet(id!),
  });
  const { data: stats } = useQuery({
    queryKey: ['pet-stats', id],
    queryFn: () => getPetStats(id!),
    enabled: !!id,
  });

  useDocumentTitle(pet ? `${pet.name} · Fetch` : null);

  const isOwner = user?.id === pet?.owner_id?.toString();

  // Paw-print celebration when a follow lands. FollowButton owns the
  // mutation, so watch its shared follower-count cache for the flip.
  const { fire, PawBurstLayer } = usePawBurst();
  const { data: followerCount } = useQuery({
    queryKey: ['follower-count', pet?.id],
    queryFn: () => getFollowerCount(pet!.id),
    enabled: !!pet && !isOwner,
  });
  const wasFollowing = useRef<boolean | null>(null);
  useEffect(() => {
    const isFollowing = followerCount?.is_following;
    if (isFollowing === undefined) return;
    if (wasFollowing.current === false && isFollowing) fire();
    wasFollowing.current = isFollowing;
  }, [followerCount?.is_following, fire]);

  // Checkin state (owner only)
  const [showCheckinPicker, setShowCheckinPicker] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const handleOpenCheckinPicker = useCallback(() => {
    setShowCheckinPicker(true);
    if (!userCoords && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserCoords({ lat: 37.7749, lng: -122.4194 }), // SF fallback
      );
    }
  }, [userCoords]);

  const { data: nearbyParks = [] } = useQuery({
    queryKey: ['parks-nearby-checkin', userCoords?.lat, userCoords?.lng],
    queryFn: () => getNearbyParks(userCoords!.lat, userCoords!.lng, 25),
    enabled: isOwner && showCheckinPicker && !!userCoords,
  });

  const checkinMutation = useMutation({
    mutationFn: (parkId: string) => checkinPark(parkId, id!),
    onSuccess: (_, parkId) => {
      toast.success('Checked in!');
      setShowCheckinPicker(false);
      queryClient.invalidateQueries({ queryKey: ['park-checkins', parkId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to check in')),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (photoId: string) => setPrimaryPhoto(pet!.id.toString(), photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pet', id] }),
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to set primary photo')),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => deletePhoto(photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pet', id] }),
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to delete photo')),
  });

  const handleShare = () => {
    // Public share page when the owner allows it (viewable by anyone, no
    // login); otherwise the in-app link for fellow members.
    const url = pet?.is_public
      ? `${window.location.origin}/pets/${id}`
      : `${window.location.origin}/app/pets/${id}`;
    shareLink(url, pet?.name ? `${pet.name} on Fetch` : 'Fetch');
  };

  // Keyboard navigation for fullscreen lightbox. Must be declared before any
  // early return so hook order stays stable across loading/loaded renders.
  useEffect(() => {
    if (fullscreenIndex === null || !pet) return;
    const photoCount = pet.photos.length;
    if (photoCount === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenIndex(null);
      else if (e.key === 'ArrowLeft')
        setFullscreenIndex((i) => (i === null ? null : (i - 1 + photoCount) % photoCount));
      else if (e.key === 'ArrowRight')
        setFullscreenIndex((i) => (i === null ? null : (i + 1) % photoCount));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenIndex, pet]);

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="w-full h-56 rounded-none -mx-4 -mt-4 mb-4" />
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-4 w-24 mb-4" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError && !isNotFound(error)) {
    return <ErrorState message="Couldn't load this pet." onRetry={() => refetch()} />;
  }
  if (!pet) {
    return <ErrorState message="Pet not found." />;
  }

  const heroPhotoUrl = petHeroPhoto(pet);
  const hasPhotos = pet.photos.length > 0;
  const age = petAge(pet.birthday);
  const openHeroLightbox = () => {
    if (!hasPhotos) return;
    const primaryIdx = pet.photos.findIndex((p) => p.id === pet.primary_photo_id);
    setFullscreenIndex(primaryIdx >= 0 ? primaryIdx : 0);
  };

  const handlePhotoUploaded = () => {
    queryClient.invalidateQueries({ queryKey: ['pet', id] });
  };

  return (
    <div className="pb-8">
      {/* Fullscreen photo overlay */}
      {fullscreenIndex !== null && pet.photos[fullscreenIndex] && (() => {
        const total = pet.photos.length;
        const current = pet.photos[fullscreenIndex];
        const goPrev = (e: React.MouseEvent) => {
          e.stopPropagation();
          setFullscreenIndex((i) => (i === null ? null : (i - 1 + total) % total));
        };
        const goNext = (e: React.MouseEvent) => {
          e.stopPropagation();
          setFullscreenIndex((i) => (i === null ? null : (i + 1) % total));
        };
        return (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setFullscreenIndex(null)}
          >
            <img
              src={photoUrl(current)}
              alt={`${pet.name} photo ${fullscreenIndex + 1} of ${total}`}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              onClick={() => setFullscreenIndex(null)}
              aria-label="Close"
            >
              <X size={18} aria-hidden />
            </button>
            {total > 1 && (
              <>
                <button
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  onClick={goPrev}
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={22} aria-hidden />
                </button>
                <button
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  onClick={goNext}
                  aria-label="Next photo"
                >
                  <ChevronRight size={22} aria-hidden />
                </button>
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/40 px-2 py-0.5 rounded-full">
                  {fullscreenIndex + 1} / {total}
                </span>
              </>
            )}
          </div>
        );
      })()}

      {/* Hero photo / placeholder */}
      {heroPhotoUrl ? (
        <img
          src={heroPhotoUrl}
          alt={pet.name}
          className="w-full h-56 object-cover cursor-pointer"
          onClick={openHeroLightbox}
        />
      ) : isOwner ? (
        <div className="w-full bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/20 p-6">
          <div className="flex flex-col items-center py-4">
            <Camera size={32} aria-hidden className="mb-2 text-brand-400" />
            <p className="text-sm text-brand-600 font-medium mb-3">Add your first photo</p>
            <PhotoUploader petId={pet.id} onUploaded={handlePhotoUploaded} />
          </div>
        </div>
      ) : (
        <div className="w-full h-56 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/20 flex flex-col items-center justify-center">
          <PetIllustration species={pet.species} name="sleeping" className="h-24 w-auto text-brand-300 dark:text-brand-400/60" />
          <span className="text-sm text-brand-400 mt-2">No photos yet</span>
        </div>
      )}

      <div className="p-4">
        <BackButton fallback="/app/pets" />

        {/* Name + age + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-bold">{pet.name}</h1>
            {stats && stats.crown_weeks.length > 0 && (
              <Badge
                variant="warning"
                icon={<Crown size={12} />}
                title={`Top Pet ${stats.crown_weeks.length === 1 ? 'once' : `${stats.crown_weeks.length} times`} — most recently the week of ${stats.crown_weeks[0]}`}
                aria-label={`Top Pet winner, ${stats.crown_weeks.length} ${stats.crown_weeks.length === 1 ? 'time' : 'times'}`}
              >
                {stats.crown_weeks.length > 1 ? `×${stats.crown_weeks.length}` : 'Top Pet'}
              </Badge>
            )}
            {age && <span className="text-sm text-gray-400 dark:text-gray-500">{age}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-brand-500 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              title="Share profile"
            >
              Share
            </button>
            {!isOwner && (
              <span className="relative inline-flex">
                <FollowButton petId={pet.id} />
                <PawBurstLayer />
              </span>
            )}
            {isOwner && (
              <Link
                to={`/app/pets/${pet.id}/edit`}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-brand-500 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                Edit
              </Link>
            )}
          </div>
        </div>
        {pet.breed_display && <p className="text-gray-500 dark:text-gray-400">{pet.breed_display}</p>}
        {stats?.week_rank != null && (
          <p className="mt-0.5 text-sm font-medium text-brand-600 dark:text-brand-400">
            #{stats.week_rank} of {stats.week_total} this week · {stats.week_score} ❤️
          </p>
        )}

        {pet.adoptable && pet.rescue_name && (
          <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10 px-3 py-2 text-sm">
            <span className="font-semibold text-brand-700 dark:text-brand-300">Adoptable</span>
            <span className="text-brand-700 dark:text-brand-300"> · available at </span>
            {pet.rescue_id ? (
              <Link to={`/app/rescues/${pet.rescue_id}`} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
                {pet.rescue_name}
              </Link>
            ) : (
              <span className="font-medium text-brand-700 dark:text-brand-300">{pet.rescue_name}</span>
            )}
          </div>
        )}

        {pet.adopted_at && (
          <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
            🎉 Adopted {new Date(pet.adopted_at).toLocaleDateString()}
            {pet.rescue_name ? ` — from ${pet.rescue_name}` : ''}
          </div>
        )}
        {pet.bio && (
          <p className="text-gray-600 dark:text-gray-300 mt-2 whitespace-pre-wrap leading-relaxed">
            <Linkify>{pet.bio}</Linkify>
          </p>
        )}
        {pet.traits && pet.traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pet.traits.map((t) => (
              <Badge key={t} variant="brand" size="md">
                {t}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1">
          <Link
            to={`/app/users/${pet.owner_id}`}
            className="text-sm text-brand-500 hover:underline"
          >
            Owner profile
          </Link>
          <span className="text-xs text-gray-400 dark:text-gray-500">Added <TimeAgo value={pet.created_at} /></span>
        </div>

        {/* Check-in widget (owner only) */}
        {isOwner && (
          <div className="mt-4">
            <button
              onClick={() => showCheckinPicker ? setShowCheckinPicker(false) : handleOpenCheckinPicker()}
              className="text-sm text-brand-500 font-medium hover:underline"
            >
              {showCheckinPicker ? 'Cancel' : '+ Check in to a park'}
            </button>
            {showCheckinPicker && (
              <div className="mt-2 flex flex-col gap-2">
                {nearbyParks.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No parks found nearby</p>
                ) : (
                  nearbyParks.map((park) => (
                    <button
                      key={park.id}
                      onClick={() => checkinMutation.mutate(park.id)}
                      disabled={checkinMutation.isPending}
                      className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm hover:border-brand-300 transition-colors text-left"
                    >
                      <span className="font-medium">{park.name}</span>
                      {park.address && <span className="text-xs text-gray-400 dark:text-gray-500 truncate ml-2">{park.address}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Photo gallery */}
        {hasPhotos && (
          <div className="mt-4">
            <h2 className="text-lg font-semibold mb-2">
              Photos <span className="text-gray-400 dark:text-gray-500 font-normal">({pet.photos.length})</span>
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {pet.photos.map((photo, idx) => {
                const url = photoUrl(photo);
                const isPrimary = photo.id === pet.primary_photo_id;
                return (
                  <div key={photo.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => setFullscreenIndex(idx)}
                      className="block w-full aspect-square rounded-lg overflow-hidden ring-1 ring-gray-100 hover:ring-2 hover:ring-brand-400 focus-visible:ring-2 focus-visible:ring-brand-500 transition-all active:scale-[0.98]"
                      aria-label={`View photo ${idx + 1} fullscreen`}
                    >
                      <img
                        src={url}
                        alt={`${pet.name} photo ${idx + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                    </button>
                    {isOwner && (
                      <>
                        <button
                          className={`absolute top-1 right-1 rounded-full w-6 h-6 flex items-center justify-center text-xs transition-opacity shadow ${
                            isPrimary
                              ? 'bg-brand-500 text-white opacity-100'
                              : 'bg-white/80 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 hover:text-brand-500'
                          }`}
                          title={isPrimary ? 'Primary photo' : 'Set as primary'}
                          aria-label={isPrimary ? 'Primary photo' : 'Set as primary'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isPrimary) setPrimaryMutation.mutate(photo.id.toString());
                          }}
                        >
                          <Star size={12} aria-hidden fill={isPrimary ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          className="absolute top-1 left-1 rounded-full w-6 h-6 flex items-center justify-center text-xs bg-white/80 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 hover:text-danger-500 dark:hover:text-danger-400 transition-opacity shadow"
                          title="Delete photo"
                          aria-label="Delete photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this photo?')) deletePhotoMutation.mutate(photo.id.toString());
                          }}
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inline photo upload for owners */}
        {isOwner && hasPhotos && (
          <div className="mt-3">
            <PhotoUploader petId={pet.id} onUploaded={handlePhotoUploaded} compact />
          </div>
        )}

        {/* Reactions */}
        <div className="mt-4">
          <ReactionBar targetType="pet" targetId={pet.id} />
        </div>

        {/* Comments */}
        <CommentSection targetType="pet" targetId={pet.id} />
      </div>
    </div>
  );
}
