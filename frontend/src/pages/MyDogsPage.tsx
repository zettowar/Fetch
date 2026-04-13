import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyDogs } from '../api/dogs';
import DogProfileCard from '../components/DogProfileCard';
import Button from '../components/ui/Button';
import { CardSkeleton } from '../components/ui/Skeleton';

export default function MyDogsPage() {
  const { data: dogs, isLoading } = useQuery({
    queryKey: ['my-dogs'],
    queryFn: getMyDogs,
  });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">My Dogs</h1>
        <Link to="/dogs/new">
          <Button size="sm">Add Dog</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : dogs && dogs.length > 0 ? (
        <div className="grid gap-4">
          {dogs.map((dog) => (
            <DogProfileCard key={dog.id} dog={dog} showEdit />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <span className="text-4xl">{'\ud83d\udc36'}</span>
          <p className="text-gray-500 mt-2 mb-4">You haven't added any dogs yet.</p>
          <Link to="/dogs/new">
            <Button>Add Your First Dog</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
