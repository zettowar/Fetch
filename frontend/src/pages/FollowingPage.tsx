import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyFollows } from '../api/social';
import { getDog } from '../api/dogs';
import { dogAge, dogHeroPhoto } from '../utils/time';
import Skeleton from '../components/ui/Skeleton';
import type { Dog } from '../types';

function FollowedDogCard({ dogId }: { dogId: string }) {
  const { data: dog, isLoading } = useQuery<Dog>({
    queryKey: ['dog', dogId],
    queryFn: () => getDog(dogId),
  });

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-2xl" />;
  }

  if (!dog) return null;

  const hero = dogHeroPhoto(dog);
  const age = dogAge(dog.birthday);

  return (
    <Link to={`/dogs/${dog.id}`} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50/30 transition-colors">
      {hero ? (
        <img src={hero} alt={dog.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🐶</span>
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="font-semibold text-gray-900 truncate">{dog.name}</h3>
          {age && <span className="text-xs text-gray-400 flex-shrink-0">{age}</span>}
        </div>
        {dog.breed && <p className="text-sm text-gray-500 truncate">{dog.breed}</p>}
        {dog.bio && <p className="text-xs text-gray-400 truncate mt-0.5">{dog.bio}</p>}
      </div>
      <span className="text-gray-300 ml-auto flex-shrink-0">›</span>
    </Link>
  );
}

export default function FollowingPage() {
  const { data: follows = [], isLoading } = useQuery({
    queryKey: ['my-follows'],
    queryFn: getMyFollows,
  });

  return (
    <div className="p-4 pb-8">
      <h1 className="text-xl font-bold mb-1">Following</h1>
      <p className="text-sm text-gray-400 mb-5">
        {follows.length > 0
          ? `${follows.length} dog${follows.length !== 1 ? 's' : ''} you follow`
          : 'Dogs you follow will appear here'}
      </p>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      )}

      {!isLoading && follows.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🐾</p>
          <p className="font-medium">No dogs followed yet</p>
          <p className="text-sm mt-1">Follow dogs from their profile page to see them here</p>
        </div>
      )}

      {!isLoading && follows.length > 0 && (
        <div className="flex flex-col gap-3">
          {follows.map((follow) => (
            <FollowedDogCard key={follow.id} dogId={follow.dog_id} />
          ))}
        </div>
      )}
    </div>
  );
}
