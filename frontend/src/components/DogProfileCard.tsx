import { Link } from 'react-router-dom';
import type { Dog } from '../types';

interface DogProfileCardProps {
  dog: Dog;
  showEdit?: boolean;
}

export default function DogProfileCard({ dog, showEdit }: DogProfileCardProps) {
  const photoUrl = dog.primary_photo_url || dog.photos[0]?.url;
  const hasPhotos = dog.photos.length > 0;

  return (
    <Link
      to={`/dogs/${dog.id}`}
      className="block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={dog.name}
          className="w-full h-44 object-cover"
        />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-brand-50 to-brand-100 flex flex-col items-center justify-center">
          <span className="text-4xl">{'\ud83d\udcf8'}</span>
          {showEdit ? (
            <span className="text-xs text-brand-500 font-medium mt-2">Tap to add a photo</span>
          ) : (
            <span className="text-xs text-brand-400 mt-1">No photo yet</span>
          )}
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{dog.name}</h3>
            {dog.breed && <p className="text-xs text-gray-500">{dog.breed}</p>}
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
                className="text-xs text-gray-400 hover:text-brand-500 px-2 py-1 rounded-lg hover:bg-gray-50"
              >
                Edit
              </Link>
            )}
          </div>
        </div>
        {dog.bio && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{dog.bio}</p>}
      </div>
    </Link>
  );
}
