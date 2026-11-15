import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyPets } from '../api/pets';
import { getCurrentRankings } from '../api/rankings';
import PetProfileCard from '../components/PetProfileCard';
import PageHeader from '../components/ui/PageHeader';
import BrandIcon from '../components/brand/BrandIcon';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function MyPetsPage() {
  useDocumentTitle('My pets · Fetchpawz');
  const { data: pets, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-pets'],
    queryFn: getMyPets,
  });

  // Rank WITHIN a species — the crown is per species (Top Dog and Top Cat),
  // and so is the rank on each pet's own page. The unscoped leaderboard mixes
  // both, so the cat leading every other cat could wear a silver medal here
  // for sitting behind a dog.
  const { data: dogBoard } = useQuery({
    queryKey: ['rankings', 'current', 'dog'],
    queryFn: () => getCurrentRankings('dog'),
  });
  const { data: catBoard } = useQuery({
    queryKey: ['rankings', 'current', 'cat'],
    queryFn: () => getCurrentRankings('cat'),
  });

  const petIdToRank = new Map<string, number>(
    [...(dogBoard ?? []), ...(catBoard ?? [])].map((entry) => [
      entry.pet_id.toString(),
      entry.rank,
    ]),
  );

  return (
    <div className="p-4">
      <PageHeader
        title="My pets"
        className="mb-4"
        action={
          // The empty state carries the screen's primary; with pets, this is it.
          <Link
            to="/app/pets/new"
            className={`btn btn-sm ${pets && pets.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
          >
            <BrandIcon name="plus" size={18} />
            Add pet
          </Link>
        }
      />

      {/* One full-width card per pet on a phone; cards are square photos, so
          wider screens deal them out in columns rather than stretching them. */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <ErrorState message="Couldn't load your pets." onRetry={() => refetch()} />
      ) : pets && pets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {pets.map((pet) => (
            <PetProfileCard
              key={pet.id}
              pet={pet}
              showEdit
              rank={petIdToRank.get(pet.id.toString())}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          illustration="sleeping"
          title="No pets yet"
          body="Add your pet to start collecting votes and climbing the weekly leaderboard."
          action={
            <Link to="/app/pets/new" className="btn btn-primary">
              Add your first pet
            </Link>
          }
        />
      )}
    </div>
  );
}
