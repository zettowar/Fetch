import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getLikedPets } from '../api/votes';
import { petHeroPhoto } from '../utils/time';
import PageHeader from '../components/ui/PageHeader';
import PetPortrait from '../components/brand/PetPortrait';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function LikedPetsPage() {
  useDocumentTitle('Liked pets · Fetchpawz');
  const { data: pets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['liked-pets'],
    queryFn: () => getLikedPets({ limit: 60 }),
  });

  return (
    <div className="p-4 pb-8">
      <PageHeader
        back
        backFallback="/app/home"
        title="Pets you liked"
        subtitle="Every pet that earned your tap, newest first."
        className="mb-5"
      />

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState message="Couldn't load your liked pets." onRetry={() => refetch()} />
      ) : pets.length === 0 ? (
        <EmptyState
          illustration="ball"
          title="No likes yet"
          body={
            <>
              <Link
                to="/app/swipe"
                className="font-bold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit"
              >
                Start swiping
              </Link>{' '}
              and they'll collect here.
            </>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {pets.map((pet) => {
            const photo = petHeroPhoto(pet);
            return (
              <Link
                key={pet.id}
                to={`/app/pets/${pet.id}`}
                className="group rounded-2xl overflow-hidden bg-white dark:bg-night-surface border-2 border-navy dark:border-white/15 shadow-toy-sm transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px hover:shadow-toy active:translate-x-[2px] active:translate-y-[3px] active:shadow-none"
              >
                <div className="aspect-square relative border-b-2 border-navy dark:border-white/15">
                  {photo ? (
                    <img src={photo} alt={pet.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <PetPortrait
                      species={pet.species}
                      breed={pet.breed_display}
                      seed={pet.id}
                      background
                      className="absolute inset-0 h-full w-full"
                    />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit truncate">{pet.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{pet.breed_display}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
