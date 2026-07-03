import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyDogs } from '../api/dogs';
import { getCurrentRankings } from '../api/rankings';
import DogProfileCard from '../components/DogProfileCard';
import Button from '../components/ui/Button';
import { CardSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';

export default function MyDogsPage() {
  const { data: dogs, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-dogs'],
    queryFn: getMyDogs,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['rankings', 'current'],
    queryFn: getCurrentRankings,
  });

  const dogIdToRank = new Map<string, number>(
    (leaderboard ?? []).map((entry) => [entry.dog_id.toString(), entry.rank]),
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span aria-hidden>🐶</span> My Dogs
        </h1>
        <Link to="/app/dogs/new">
          <Button size="sm">+ Add Dog</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <ErrorState message="Couldn't load your dogs." onRetry={() => refetch()} />
      ) : dogs && dogs.length > 0 ? (
        <div className="grid gap-4">
          {dogs.map((dog) => (
            <DogProfileCard
              key={dog.id}
              dog={dog}
              showEdit
              rank={dogIdToRank.get(dog.id.toString())}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🐶"
          title="No dogs yet"
          body="Add your pup to start collecting votes and climbing the weekly leaderboard."
          action={
            <Link to="/app/dogs/new">
              <Button>Add your first dog</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
