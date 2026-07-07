import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PawPrint as DogIcon } from 'lucide-react';
import { getMyPets } from '../api/pets';
import { getCurrentRankings } from '../api/rankings';
import PetProfileCard from '../components/PetProfileCard';
import Button from '../components/ui/Button';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';

export default function MyPetsPage() {
  const { data: pets, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-pets'],
    queryFn: getMyPets,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['rankings', 'current'],
    queryFn: () => getCurrentRankings(),
  });

  const petIdToRank = new Map<string, number>(
    (leaderboard ?? []).map((entry) => [entry.pet_id.toString(), entry.rank]),
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DogIcon size={22} aria-hidden className="text-brand-500" /> My Pets
        </h1>
        <Link to="/app/pets/new">
          <Button size="sm">+ Add Pet</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <ErrorState message="Couldn't load your pets." onRetry={() => refetch()} />
      ) : pets && pets.length > 0 ? (
        <div className="grid gap-4">
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
            <Link to="/app/pets/new">
              <Button>Add your first pet</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
