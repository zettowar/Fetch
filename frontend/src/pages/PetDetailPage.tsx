import { useState, useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Star, X } from 'lucide-react';
import BrandIcon from '../components/brand/BrandIcon';
import PetPortrait, { portraitFor, portraitTint } from '../components/brand/PetPortrait';
import { Crown } from '../components/brand/RankMedal';
import Sticker from '../components/brand/Sticker';
import { getPet, setPrimaryPhoto } from '../api/pets';
import { deletePhoto } from '../api/photos';
import { getNearbyParks, checkinPark } from '../api/parks';
import { getPetStats } from '../api/rankings';
import { getFollowerCount } from '../api/social';
import { useAuth } from '../store/AuthContext';
import FollowButton from '../components/FollowButton';
import ReactionBar from '../components/ReactionBar';
import CommentSection from '../components/CommentSection';
import { ReportButton } from '../components/ReportDialog';
import PhotoUploader from '../components/PhotoUploader';
import PetPhoto, { InReviewBadge, isInReview } from '../components/PetPhoto';
import BackButton from '../components/ui/BackButton';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import ErrorState, { NOT_FOUND_HINT } from '../components/ui/ErrorState';
import { usePawBurst } from '../components/flair/PawBurst';
import Linkify from '../components/Linkify';
import TimeAgo from '../components/TimeAgo';
import { petAge, petHeroPhoto } from '../utils/time';
import { DEFAULT_MAP_CENTER } from '../utils/useUserLocation';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { shareLink } from '../utils/shareLink';
import { formatWeekOf } from '../utils/weeklyReset';
import { occasionShort, occasionToday } from '../utils/occasions';
import { apiErrorMessage, isNotFound } from '../utils/apiError';
import { photoIn } from '../utils/photoIn';
import { DESKTOP_UP, useMediaQuery } from '../hooks/useMediaQuery';
import { useSectionOpen } from '../hooks/usePublicFlags';

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

  useDocumentTitle(pet ? `${pet.name} · Fetchpawz` : null);

  const isOwner = user?.id === pet?.owner_id?.toString();
  // Desktop moves the gallery into the photo column (see `gallery` below).
  const isDesktop = useMediaQuery(DESKTOP_UP);

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
        () => setUserCoords({ lat: DEFAULT_MAP_CENTER[1], lng: DEFAULT_MAP_CENTER[0] }),
      );
    }
  }, [userCoords]);

  const {
    data: nearbyParks = [],
    isLoading: parksLoading,
    isError: parksFailed,
  } = useQuery({
    queryKey: ['parks-nearby-checkin', userCoords?.lat, userCoords?.lng],
    queryFn: () => getNearbyParks(userCoords!.lat, userCoords!.lng, 25),
    enabled: isOwner && showCheckinPicker && !!userCoords,
  });
  // Parks is a flag-gated section; with it off, checking in leads nowhere.
  const parksOpen = useSectionOpen('explore_parks_enabled');

  const checkinMutation = useMutation({
    mutationFn: (parkId: string) => checkinPark(parkId, id!),
    onSuccess: (_, parkId) => {
      toast.success('Checked in!');
      setShowCheckinPicker(false);
      queryClient.invalidateQueries({ queryKey: ['park-checkins', parkId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't check you in. Try again.")),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (photoId: string) => setPrimaryPhoto(pet!.id.toString(), photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pet', id] }),
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't change the main photo. Try again.")),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => deletePhoto(photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pet', id] }),
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't delete that photo. Try again.")),
  });

  const handleShare = () => {
    // Public share page when the owner allows it (viewable by anyone, no
    // login); otherwise the in-app link for fellow members.
    const url = pet?.is_public
      ? `${window.location.origin}/pets/${id}`
      : `${window.location.origin}/app/pets/${id}`;
    shareLink(url, pet?.name ? `${pet.name} on Fetchpawz` : 'Fetchpawz');
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
      // Same shape as the loaded page: a centred column on tablet, the photo
      // beside the name on desktop.
      <div className="p-4 sm:mx-auto sm:max-w-2xl sm:p-0 lg:max-w-none lg:grid lg:grid-cols-2 lg:gap-x-8 xl:gap-x-10">
        <Skeleton className="w-[calc(100%+2rem)] h-60 rounded-none -mx-4 -mt-4 mb-4 sm:w-full sm:mx-0 sm:mt-0 sm:rounded-3xl lg:row-span-4 lg:mb-0 lg:h-auto lg:aspect-square lg:self-start" />
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
    return <ErrorState message="Pet not found." hint={NOT_FOUND_HINT} />;
  }

  const heroPhotoUrl = petHeroPhoto(pet);
  const crowns = stats?.crown_weeks.length ?? 0;
  const occasion = occasionToday(pet);
  const hasPhotos = pet.photos.length > 0;
  // Only ever non-zero on the owner's own view — nobody else is sent them.
  const reviewCount = pet.photos.filter(isInReview).length;
  const age = petAge(pet.birthday, pet.species);
  const openHeroLightbox = () => {
    if (!hasPhotos) return;
    const primaryIdx = pet.photos.findIndex((p) => p.id === pet.primary_photo_id);
    setFullscreenIndex(primaryIdx >= 0 ? primaryIdx : 0);
  };

  const handlePhotoUploaded = () => {
    queryClient.invalidateQueries({ queryKey: ['pet', id] });
  };

  // The gallery and the owner's add-photo row under it. On desktop they sit
  // under the hero, in the photo column; everywhere else they come after the
  // facts, as they always have. CSS can't move one block between the two
  // columns without rendering it twice (two uploaders, two sets of owner
  // controls, the in-review blobs fetched for both), so this one placement
  // branches on the layout in JS.
  const gallery = (
    <>
      {/* Photo gallery */}
      {hasPhotos && (
        <div className="mt-4">
          <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit mb-2">
            Photos <span className="text-gray-500 dark:text-gray-400 font-bold">({pet.photos.length})</span>
          </h2>
          {isOwner && reviewCount > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {reviewCount === 1 ? 'One photo is' : `${reviewCount} photos are`} being
              reviewed. Only you can see {reviewCount === 1 ? 'it' : 'them'} until
              that's done — usually just a few minutes.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {pet.photos.map((photo, idx) => {
              const isPrimary = photo.id === pet.primary_photo_id;
              const inReview = isInReview(photo);
              return (
                <div key={photo.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => setFullscreenIndex(idx)}
                    className="block w-full aspect-square rounded-lg overflow-hidden border-2 border-navy dark:border-white/20 transition-transform hover:-translate-y-px active:translate-y-[2px]"
                    aria-label={`View photo ${idx + 1} fullscreen`}
                  >
                    <PetPhoto
                      photo={photo}
                      alt={`${pet.name} photo ${idx + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  </button>
                  {inReview && <InReviewBadge className="absolute bottom-1 left-1" />}
                  {isOwner && (
                    <>
                      {/* No "make primary" while in review — a withheld
                          primary blanks the pet's hero for everyone else, and
                          the backend refuses it. Delete stays available. */}
                      {!inReview && (
                        <button
                          className={`absolute top-1 right-1 rounded-full w-6 h-6 flex items-center justify-center text-xs transition-opacity shadow ${
                            isPrimary
                              ? 'border-[1.5px] border-navy bg-brand-500 text-navy opacity-100'
                              : 'border-[1.5px] border-navy/30 bg-white/90 text-gray-600 reveal-on-hover hover:text-navy'
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
                      )}
                      <button
                        className="absolute top-1 left-1 rounded-full w-6 h-6 flex items-center justify-center text-xs border-[1.5px] border-navy/30 bg-white/90 text-gray-600 reveal-on-hover hover:text-danger-600 transition-opacity"
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
    </>
  );

  return (
    // Phone and tablet: one stack — the hero, then everything else (tablet
    // centres it; a 935px-wide square photo is a poster, not a profile).
    // Desktop: the back link across the top, then the photo and its gallery
    // on the left and the name, numbers and conversation on the right. The
    // `contents` wrappers vanish below lg, so the phone stack keeps its order.
    <div className="pb-8 sm:mx-auto sm:max-w-2xl lg:max-w-none lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8 xl:gap-x-10">
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
            className="fixed inset-0 z-50 bg-night/95 flex items-center justify-center"
            onClick={() => setFullscreenIndex(null)}
          >
            <PetPhoto
              photo={current}
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

      {/* Hero photo / placeholder, with at most one die-cut sticker slapped on
          its bottom edge — the screen's one tilted thing. A crown outranks an
          adoption call; gold is for the earned, pink for rescue. Edge to edge
          on a phone; on sm+ it is a card you can tap open (no overflow-hidden:
          the sticker hangs off its edge, so the frames round themselves). */}
      <div className="contents lg:block lg:col-start-1 lg:row-start-2">
      <div className="relative border-b-[2.5px] border-navy bg-brand-100 dark:border-white/15 dark:bg-night-raised sm:rounded-3xl sm:border-[2.5px] sm:shadow-toy">
      {occasion?.kind === 'birthday' ? (
        // A birthday is one day a year; it outranks everything else for it.
        <Sticker fill="orange" tilt={-5} className="absolute -bottom-4 right-4 z-10">
          {occasionShort(occasion)}
        </Sticker>
      ) : crowns > 0 ? (
        <Sticker fill="gold" tilt={-5} className="absolute -bottom-4 right-4 z-10">
          <Crown className="w-5" />
          {pet.species === 'cat' ? 'Top Cat' : 'Top Dog'}
          {crowns > 1 && <span className="font-sans text-base font-black">×{crowns}</span>}
        </Sticker>
      ) : pet.adoptable && pet.rescue_name ? (
        <Sticker fill="pink" tilt={-5} className="absolute -bottom-4 right-4 z-10">Adopt me</Sticker>
      ) : occasion?.kind === 'homecoming' ? (
        <Sticker fill="pink" tilt={4} className="absolute -bottom-4 right-4 z-10">{occasionShort(occasion)}</Sticker>
      ) : pet.adopted_at ? (
        <Sticker fill="pink" tilt={4} className="absolute -bottom-4 right-4 z-10">Adopted!</Sticker>
      ) : null}
      {heroPhotoUrl ? (
        <img
          src={heroPhotoUrl}
          alt={pet.name}
          ref={photoIn}
          className="photo-in block aspect-square w-full object-cover cursor-pointer sm:rounded-[25.5px]"
          onClick={openHeroLightbox}
        />
      ) : isOwner ? (
        <div className="w-full bg-brand-100 p-6 dark:bg-night-surface sm:rounded-[25.5px]">
          <div className="flex flex-col items-center py-4">
            <BrandIcon name="camera" size={32} className="mb-2 text-navy dark:text-biscuit" />
            <p className="text-sm text-navy dark:text-biscuit font-extrabold mb-3">Add your first photo</p>
            <PhotoUploader petId={pet.id} onUploaded={handlePhotoUploaded} />
          </div>
        </div>
      ) : (
        <div
          className="flex aspect-square w-full items-end justify-center sm:overflow-hidden sm:rounded-[25.5px]"
          style={{ background: portraitTint(portraitFor(pet.species, pet.breed_display, pet.id)) }}
        >
          <PetPortrait
            species={pet.species}
            breed={pet.breed_display}
            seed={pet.id}
            className="h-[95%] w-auto"
            title={`${pet.name}, no photos yet`}
          />
        </div>
      )}
      </div>
      {isDesktop && <div className="pt-4">{gallery}</div>}
      </div>

      <div className="p-4 sm:px-0 lg:contents">
        <div className="contents lg:block lg:col-span-2 lg:row-start-1">
          <BackButton fallback="/app/pets" />
        </div>

        <div className="contents lg:block lg:col-start-2 lg:row-start-2">

        {/* Name + age + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h1 className="text-[34px] leading-none text-navy dark:text-biscuit">{pet.name}</h1>
            {crowns > 0 && (
              // The sticker on the hero says it loudly; this says it precisely.
              <span className="sr-only">
                {`Top ${pet.species === 'cat' ? 'Cat' : 'Dog'} ${crowns === 1 ? 'once' : `${crowns} times`}, most recently the week of ${formatWeekOf(stats!.crown_weeks[0])}`}
              </span>
            )}
            {age && <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{age}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="btn btn-ghost btn-sm px-2.5"
              title="Share profile"
            >
              <BrandIcon name="share" size={16} />
              Share
            </button>
            {!isOwner && (
              <span className="relative inline-flex">
                <FollowButton petId={pet.id} />
                <PawBurstLayer />
              </span>
            )}
            {isOwner && (
              <Link to={`/app/pets/${pet.id}/edit`} className="btn btn-secondary btn-sm">
                Edit
              </Link>
            )}
          </div>
        </div>
        {pet.breed_display && (
          <p className="mt-1 font-semibold text-gray-600 dark:text-gray-300">{pet.breed_display}</p>
        )}
        {stats?.week_rank != null && (
          // Three numbers, drawn like the brand book's stat tiles.
          <div className="mt-3 grid grid-cols-3 gap-2" aria-label={`Rank ${stats.week_rank} of ${stats.week_total} this week, score ${stats.week_score}`}>
            <div className="surface px-2 py-2 text-center">
              <p className="font-display text-2xl leading-none text-navy dark:text-biscuit">#{stats.week_rank}</p>
              <p className="eyebrow mt-1">of {stats.week_total}</p>
            </div>
            <div className="surface px-2 py-2 text-center">
              <p className="font-display text-2xl leading-none text-navy dark:text-biscuit">{stats.week_score}</p>
              <p className="eyebrow mt-1">score</p>
            </div>
            <div className="surface px-2 py-2 text-center">
              <p className="font-display text-2xl leading-none text-navy dark:text-biscuit">{stats.likes}</p>
              <p className="eyebrow mt-1">likes</p>
            </div>
          </div>
        )}

        {pet.adoptable && pet.rescue_name && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-navy bg-pink-100 px-3 py-2.5 text-sm text-navy dark:border-pink-400/50 dark:bg-pink-500/15 dark:text-biscuit">
            <Badge variant="rescue">Needs a home</Badge>
            <span>
              Available at{' '}
              {pet.rescue_id ? (
                <Link to={`/app/rescues/${pet.rescue_id}`} className="font-extrabold hover:underline">
                  {pet.rescue_name}
                </Link>
              ) : (
                <span className="font-extrabold">{pet.rescue_name}</span>
              )}
            </span>
          </div>
        )}

        {pet.adopted_at && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-night-surface px-3 py-2.5 text-sm text-navy dark:text-biscuit">
            <BrandIcon name="rescue" size={18} />
            Adopted {new Date(pet.adopted_at).toLocaleDateString()}
            {pet.rescue_name ? ` — from ${pet.rescue_name}` : ''}
          </div>
        )}
        {pet.bio && (
          <p className="text-navy/85 dark:text-biscuit/85 mt-3 whitespace-pre-wrap leading-relaxed">
            <Linkify>{pet.bio}</Linkify>
          </p>
        )}
        {pet.traits && pet.traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {pet.traits.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mt-3">
          <Link
            to={`/app/users/${pet.owner_id}`}
            className="text-sm font-extrabold text-brand-700 dark:text-brand-400 hover:underline"
          >
            Owner profile
          </Link>
          <span className="text-xs text-gray-500 dark:text-gray-400">Added <TimeAgo value={pet.created_at} /></span>
          {!isOwner && (
            <ReportButton
              targetType="pet"
              targetId={pet.id}
              targetLabel={pet.name}
              className="ml-auto"
            />
          )}
        </div>

        {/* Check-in widget (owner only) */}
        {isOwner && parksOpen && (
          <div className="mt-4">
            <button
              onClick={() => showCheckinPicker ? setShowCheckinPicker(false) : handleOpenCheckinPicker()}
              className={showCheckinPicker ? 'btn btn-ghost btn-sm' : 'btn btn-park btn-sm'}
            >
              {!showCheckinPicker && <BrandIcon name="park" size={16} style={{ '--bean': '#1C1F45' } as React.CSSProperties} />}
              {showCheckinPicker ? 'Cancel' : 'Check in to a park'}
            </button>
            {showCheckinPicker && (
              <div className="mt-2 flex flex-col gap-2">
                {/* "No parks found nearby" is an answer; it used to show while
                    the location prompt was still open, while loading, and on
                    failure. */}
                {!userCoords || parksLoading ? (
                  <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Finding parks near you…</p>
                ) : parksFailed ? (
                  <p role="status" className="text-sm text-gray-600 dark:text-gray-300">Couldn&rsquo;t load nearby parks. Try again in a moment.</p>
                ) : nearbyParks.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No parks found nearby</p>
                ) : (
                  nearbyParks.map((park) => (
                    <button
                      key={park.id}
                      onClick={() => checkinMutation.mutate(park.id)}
                      disabled={checkinMutation.isPending}
                      className="flex items-center justify-between px-3 py-2 bg-white dark:bg-night-surface border-2 border-navy/20 dark:border-white/15 rounded-xl text-sm hover:border-green-500 transition-colors text-left"
                    >
                      <span className="font-extrabold">{park.name}</span>
                      {park.address && <span className="text-xs text-gray-500 dark:text-gray-400 truncate ml-2">{park.address}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {!isDesktop && gallery}

        {/* Reactions */}
        <div className="mt-4">
          <ReactionBar targetType="pet" targetId={pet.id} />
        </div>

        {/* Comments */}
        <CommentSection targetType="pet" targetId={pet.id} />
        </div>
      </div>
    </div>
  );
}
