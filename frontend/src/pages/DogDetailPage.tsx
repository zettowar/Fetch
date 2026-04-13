import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getDog } from '../api/dogs';
import { getDogStats } from '../api/rankings';
import { useAuth } from '../store/AuthContext';
import FollowButton from '../components/FollowButton';
import ReactionBar from '../components/ReactionBar';
import CommentSection from '../components/CommentSection';
import PhotoUploader from '../components/PhotoUploader';
import BackButton from '../components/ui/BackButton';
import Skeleton from '../components/ui/Skeleton';
import { dogAge, relativeTime, photoUrl } from '../utils/time';

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
    return <div className="p-4 text-center text-gray-500">Dog not found</div>;
  }

  const isOwner = user?.id === dog.owner_id;
  const photoUrl = dog.primary_photo_url || dog.photos[0]?.url;
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
          <button className="absolute top-4 right-4 text-white text-2xl" onClick={() => setFullscreenPhoto(null)}>
            X
          </button>
        </div>
      )}

      {/* Hero photo / placeholder */}
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={dog.name}
          className="w-full h-56 object-cover cursor-pointer"
          onClick={() => setFullscreenPhoto(photoUrl)}
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

        {/* Photo gallery */}
        {hasPhotos && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Photos</h2>
              <span className="text-xs text-gray-400">{dog.photos.length} photo{dog.photos.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {dog.photos.map((photo) => (
                <img
                  key={photo.id}
                  src={photoUrl(photo)}
                  alt=""
                  className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setFullscreenPhoto(photoUrl(photo))}
                />
              ))}
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
