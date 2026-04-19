import { Link } from 'react-router-dom';
import type { Dog } from '../types';
import { dogHeroPhoto } from '../utils/time';

const RANK_EMOJI: Record<number, string> = { 1: '\ud83e\udd47', 2: '\ud83e\udd48', 3: '\ud83e\udd49' };

interface DogProfileCardProps {
  dog: Dog;
  showEdit?: boolean;
  rank?: number;
}

export default function DogProfileCard({ dog, showEdit, rank }: DogProfileCardProps) {
  const photoUrl = dogHeroPhoto(dog);
  const photoCount = dog.photos.length;
  const hasPhotos = photoCount > 0;
  const rankLabel = rank ? RANK_EMOJI[rank] || `#${rank}` : null;

  return (
    <Link
      to={`/dogs/${dog.id}`}
      className="block bg-white dark:bg-gray-900 rounded-2xl shadow-soft-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-200 ease-soft-out hover:shadow-soft hover:-translate-y-0.5 active:scale-[0.99]"
    >
      <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={dog.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-50 to-brand-100 flex flex-col items-center justify-center">
            <span className="text-4xl">{'\ud83d\udcf8'}</span>
            {showEdit ? (
              <span className="text-xs text-brand-500 font-medium mt-2">Tap to add a photo</span>
            ) : (
              <span className="text-xs text-brand-400 mt-1">No photo yet</span>
            )}
          </div>
        )}
        {rankLabel && (
          <span
            className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 bg-white/90 backdrop-blur-sm text-brand-600 text-xs font-semibold rounded-full shadow-sm"
            title={`Current rank: ${rank}`}
          >
            <span>{rankLabel}</span>
            {rank && rank > 3 && <span className="sr-only">Rank {rank}</span>}
          </span>
        )}
        {photoCount > 1 && (
          <span
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 bg-white/90 backdrop-blur-sm text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-full shadow-sm"
            title={`${photoCount} photos`}
            aria-label={`${photoCount} photos`}
          >
            <span aria-hidden>📷</span>
            {photoCount}
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{dog.name}</h3>
            {dog.breed_display && <p className="text-xs text-gray-500 dark:text-gray-400">{dog.breed_display}</p>}
          </div>
          <div className="flex items-center gap-2">
            {showEdit && !hasPhotos && (
              <span className="text-[10px] bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full font-medium">
                Add photo
              </span>
            )}
            {showEdit && (
              <Link
                to={`/dogs/${dog.id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-brand-500 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                Edit
              </Link>
            )}
          </div>
        </div>
        {dog.bio && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{dog.bio}</p>}
      </div>
    </Link>
  );
}
