import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getMyFollows } from '../api/social';
import { petAge, petHeroPhoto } from '../utils/time';
import { ListSkeleton } from '../components/ui/Skeleton';
import PageHeader from '../components/ui/PageHeader';
import PetPortrait from '../components/brand/PetPortrait';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import type { Pet } from '../types';
import { useDocumentTitle } from '../utils/useDocumentTitle';

function FollowedDogCard({ pet }: { pet: Pet }) {
  const hero = petHeroPhoto(pet);
  const age = petAge(pet.birthday, pet.species);

  return (
    // A pet card is a thing you touch: navy line and the small toy shadow.
    <Link
      to={`/app/pets/${pet.id}`}
      className="flex items-center gap-3 p-3 bg-white dark:bg-night-surface rounded-2xl border-2 border-navy dark:border-white/15 shadow-toy-sm transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px hover:shadow-toy active:translate-x-[2px] active:translate-y-[3px] active:shadow-none"
    >
      {hero ? (
        <img src={hero} alt={pet.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border-[1.5px] border-navy/20 dark:border-white/10" />
      ) : (
        <PetPortrait
          species={pet.species}
          breed={pet.breed_display}
          seed={pet.id}
          background
          className="w-16 h-16 rounded-lg flex-shrink-0"
        />
      )}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit truncate">{pet.name}</h3>
          {age && <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{age}</span>}
        </div>
        {pet.breed_display && <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{pet.breed_display}</p>}
        {pet.bio && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{pet.bio}</p>}
      </div>
      <ChevronRight size={18} aria-hidden className="text-navy/40 dark:text-white/30 ml-auto flex-shrink-0" />
    </Link>
  );
}

export default function FollowingPage() {
  useDocumentTitle('Following · Fetchpawz');
  const { data: follows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my-follows'],
    queryFn: getMyFollows,
  });

  const followedDogs = follows.map((f) => f.pet).filter((d): d is Pet => !!d);

  return (
    <div className="p-4 pb-8">
      <PageHeader
        title="Following"
        className="mb-5"
        subtitle={
          followedDogs.length > 0
            ? `${followedDogs.length} pet${followedDogs.length !== 1 ? 's' : ''} you follow`
            : 'Pets you follow will appear here'
        }
      />

      {isLoading && <ListSkeleton rows={4} />}

      {!isLoading && isError && (
        <ErrorState message="Couldn't load the pets you follow." onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && followedDogs.length === 0 && (
        <EmptyState
          illustration="ball"
          title="No pets followed yet"
          body="Follow pets from their profile to keep up with their photos and posts."
          action={
            <>
              <Link to="/app/swipe" className="btn btn-primary btn-sm">
                Start swiping
              </Link>
              <Link to="/app/rankings" className="btn btn-secondary btn-sm">
                Browse top pets
              </Link>
            </>
          }
        />
      )}

      {/* Rows on a phone; on wider screens the same row cards tile, two or
          three across, instead of stretching a 64px photo's row to 900px. */}
      {!isLoading && followedDogs.length > 0 && (
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {followedDogs.map((pet) => (
            <FollowedDogCard key={pet.id} pet={pet} />
          ))}
        </div>
      )}
    </div>
  );
}
