import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyFollows } from '../api/social';
import { dogAge, dogHeroPhoto } from '../utils/time';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import type { Dog } from '../types';

function FollowedDogCard({ dog }: { dog: Dog }) {
  const hero = dogHeroPhoto(dog);
  const age = dogAge(dog.birthday);

  return (
    <Link to={`/dogs/${dog.id}`} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-brand-200 hover:bg-brand-50/30 transition-colors">
      {hero ? (
        <img src={hero} alt={dog.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🐶</span>
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{dog.name}</h3>
          {age && <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{age}</span>}
        </div>
        {dog.breed_display && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{dog.breed_display}</p>}
        {dog.bio && <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{dog.bio}</p>}
      </div>
      <span className="text-gray-300 dark:text-gray-600 ml-auto flex-shrink-0">›</span>
    </Link>
  );
}

export default function FollowingPage() {
  const { data: follows = [], isLoading } = useQuery({
    queryKey: ['my-follows'],
    queryFn: getMyFollows,
  });

  const followedDogs = follows.map((f) => f.dog).filter((d): d is Dog => !!d);

  return (
    <div className="p-4 pb-8">
      <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
        <span aria-hidden>🐾</span> Following
      </h1>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">
        {followedDogs.length > 0
          ? `${followedDogs.length} dog${followedDogs.length !== 1 ? 's' : ''} you follow`
          : 'Dogs you follow will appear here'}
      </p>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      )}

      {!isLoading && followedDogs.length === 0 && (
        <EmptyState
          icon="🐾"
          title="No dogs followed yet"
          body="Follow dogs from their profile to keep up with their photos and posts."
          action={
            <>
              <Link to="/swipe">
                <Button size="sm">Start swiping</Button>
              </Link>
              <Link to="/rankings">
                <Button size="sm" variant="secondary">Browse top dogs</Button>
              </Link>
            </>
          }
        />
      )}

      {!isLoading && followedDogs.length > 0 && (
        <div className="flex flex-col gap-3">
          {followedDogs.map((dog) => (
            <FollowedDogCard key={dog.id} dog={dog} />
          ))}
        </div>
      )}
    </div>
  );
}
