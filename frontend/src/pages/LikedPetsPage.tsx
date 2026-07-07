import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { getLikedPets } from '../api/votes';
import { petHeroPhoto } from '../utils/time';
import BackButton from '../components/ui/BackButton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function LikedPetsPage() {
  useDocumentTitle('Liked pets · Fetch');
  const { data: pets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['liked-pets'],
    queryFn: () => getLikedPets({ limit: 60 }),
  });

  return (
    <div className="p-4 pb-8">
      <BackButton fallback="/app/home" />
      <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
        <Heart size={20} aria-hidden fill="currentColor" strokeWidth={0} className="text-danger-500" /> Pets you liked
      </h1>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">
        Every pet that earned your tap, newest first.
      </p>

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
              <Link to="/app/swipe" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
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
                className="group rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-soft-sm hover:-translate-y-0.5 hover:shadow-soft transition-all duration-200 ease-soft-out"
              >
                <div className="aspect-square bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/20 relative">
                  {photo ? (
                    <img src={photo} alt={pet.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-4xl" aria-hidden>🐕</span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{pet.name}</p>
                  <p className="text-2xs text-gray-400 dark:text-gray-500 truncate">{pet.breed_display}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
