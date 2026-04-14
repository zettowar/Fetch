import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getDog, setPrimaryPhoto } from '../api/dogs';
import { deletePhoto } from '../api/photos';
import { getDogStats } from '../api/rankings';
import { getNearbyParks, checkinPark } from '../api/parks';
import { useAuth } from '../store/AuthContext';
import FollowButton from '../components/FollowButton';
import ReactionBar from '../components/ReactionBar';
import CommentSection from '../components/CommentSection';
import PhotoUploader from '../components/PhotoUploader';
import BackButton from '../components/ui/BackButton';
import Skeleton from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import { dogAge, relativeTime, photoUrl, dogHeroPhoto } from '../utils/time';

export default function DogDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  const { data: dog, isLoading } = useQuery({
    queryKey: ['dog', id],
    queryFn: () => getDog(id!),
  });

  const { data: stats } = useQuery({
    queryKey: ['dog-stats', id],
    queryFn: () => getDogStats(id!),
    enabled: !!id,
  });

  const isOwner = user?.id === dog?.owner_id?.toString();

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
    onError: () => toast.error('Failed to check in'),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (photoId: string) => setPrimaryPhoto(dog!.id.toString(), photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dog', id] }),
    onError: () => toast.error('Failed to set primary photo'),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => deletePhoto(photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dog', id] }),
    onError: () => toast.error('Failed to delete photo'),
  });

  const handleShare = async () => {
    const url = `${window.location.origin}/dogs/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    } catch {
      toast('Could not copy link');
    }
  };

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

  if (!dog) {
    return <ErrorState message="Dog not found." />;
  }

  const heroPhotoUrl = dogHeroPhoto(dog);
  const hasPhotos = dog.photos.length > 0;
  const age = dogAge(dog.birthday);

  const handlePhotoUploaded = () => {
    queryClient.invalidateQueries({ queryKey: ['dog', id] });
  };

  return (
    <div className="pb-8">
      {/* Fullscreen photo overlay */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setFullscreenPhoto(null)}
        >
          <img src={fullscreenPhoto} alt="" className="max-w-full max-h-full object-contain" />
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            onClick={() => setFullscreenPhoto(null)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero photo / placeholder */}
      {heroPhotoUrl ? (
        <img
          src={heroPhotoUrl}
          alt={dog.name}
          className="w-full h-56 object-cover cursor-pointer"
          onClick={() => setFullscreenPhoto(heroPhotoUrl)}
        />
      ) : isOwner ? (
        <div className="w-full bg-gradient-to-br from-brand-50 to-brand-100 p-6">
          <div className="flex flex-col items-center py-4">
            <span className="text-4xl mb-2">{'\ud83d\udcf8'}</span>
            <p className="text-sm text-brand-600 font-medium mb-3">Add your first photo</p>
            <PhotoUploader dogId={dog.id} onUploaded={handlePhotoUploaded} />
          </div>
        </div>
      ) : (
        <div className="w-full h-56 bg-gradient-to-br from-brand-50 to-brand-100 flex flex-col items-center justify-center">
          <span className="text-5xl">{'\ud83d\udc36'}</span>
          <span className="text-sm text-brand-400 mt-2">No photos yet</span>
        </div>
      )}

      <div className="p-4">
        <BackButton fallback="/dogs" />

        {/* Name + age + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-bold">{dog.name}</h1>
            {age && <span className="text-sm text-gray-400">{age}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="text-xs text-gray-400 hover:text-brand-500 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
              title="Share profile"
            >
              Share
            </button>
            {!isOwner && <FollowButton dogId={dog.id} />}
            {isOwner && (
              <Link
                to={`/dogs/${dog.id}/edit`}
                className="text-xs text-gray-400 hover:text-brand-500 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit
              </Link>
            )}
          </div>
        </div>
        {dog.breed && <p className="text-gray-500">{dog.breed}</p>}
        {dog.bio && <p className="text-gray-600 mt-2">{dog.bio}</p>}
        {dog.traits && dog.traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {dog.traits.map((t) => (
              <span key={t} className="px-2.5 py-0.5 bg-brand-50 text-brand-600 text-xs rounded-full font-medium border border-brand-100">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1">
          <Link
            to={`/users/${dog.owner_id}`}
            className="text-sm text-brand-500 hover:underline"
          >
            Owner profile
          </Link>
          <span className="text-xs text-gray-400">Added {relativeTime(dog.created_at)}</span>
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex gap-6 mt-4 p-4 bg-gray-50 rounded-xl">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{stats.likes}</p>
              <p className="text-xs text-gray-500">Likes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-400">{stats.passes}</p>
              <p className="text-xs text-gray-500">Passes</p>
            </div>
          </div>
        )}

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
                  <p className="text-sm text-gray-400">No parks found nearby</p>
                ) : (
                  nearbyParks.map((park) => (
                    <button
                      key={park.id}
                      onClick={() => checkinMutation.mutate(park.id)}
                      disabled={checkinMutation.isPending}
                      className="flex items-center justify-between px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm hover:border-brand-300 transition-colors text-left"
                    >
                      <span className="font-medium">{park.name}</span>
                      {park.address && <span className="text-xs text-gray-400 truncate ml-2">{park.address}</span>}
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Photos</h2>
              <span className="text-xs text-gray-400">{dog.photos.length} photo{dog.photos.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {dog.photos.map((photo) => {
                const url = photoUrl(photo);
                const isPrimary = photo.id === dog.primary_photo_id;
                return (
                  <div key={photo.id} className="relative group">
                    <img
                      src={url}
                      alt=""
                      className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setFullscreenPhoto(url)}
                    />
                    {isOwner && (
                      <>
                        <button
                          className={`absolute top-1 right-1 rounded-full w-6 h-6 flex items-center justify-center text-xs transition-opacity shadow ${
                            isPrimary
                              ? 'bg-brand-500 text-white opacity-100'
                              : 'bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-brand-500'
                          }`}
                          title={isPrimary ? 'Primary photo' : 'Set as primary'}
                          aria-label={isPrimary ? 'Primary photo' : 'Set as primary'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isPrimary) setPrimaryMutation.mutate(photo.id.toString());
                          }}
                        >
                          ★
                        </button>
                        <button
                          className="absolute top-1 left-1 rounded-full w-6 h-6 flex items-center justify-center text-xs bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity shadow"
                          title="Delete photo"
                          aria-label="Delete photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this photo?')) deletePhotoMutation.mutate(photo.id.toString());
                          }}
                        >
                          ✕
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
            <PhotoUploader dogId={dog.id} onUploaded={handlePhotoUploaded} compact />
          </div>
        )}

        {/* Reactions */}
        <div className="mt-4">
          <ReactionBar targetType="dog" targetId={dog.id} />
        </div>

        {/* Comments */}
        <CommentSection targetType="dog" targetId={dog.id} />
      </div>
    </div>
  );
}
