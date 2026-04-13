import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCurrentWinner } from '../api/rankings';
import { useAuth } from '../store/AuthContext';
import Button from '../components/ui/Button';

export default function HomePage() {
  const { user } = useAuth();
  const { data: winner, isError } = useQuery({
    queryKey: ['weekly-winner'],
    queryFn: getCurrentWinner,
  });

  return (
    <div className="flex flex-col">
      {/* Hero: Weekly Winner */}
      <div className="relative h-56 bg-gradient-to-b from-brand-400 to-brand-600 flex items-center justify-center overflow-hidden rounded-b-3xl">
        {winner?.primary_photo_url && (
          <img
            src={winner.primary_photo_url}
            alt={winner.dog_name || 'Weekly winner'}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        <div className="relative z-10 text-center text-white px-4">
          <p className="text-xs uppercase tracking-widest opacity-80">{'\ud83c\udfc6'} This Week's Top Dog</p>
          {winner ? (
            <>
              <h2 className="text-3xl font-bold mt-1">{winner.dog_name}</h2>
              {winner.breed && <p className="text-base opacity-90">{winner.breed}</p>}
              <p className="text-sm opacity-70 mt-1">Score: {winner.score}</p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mt-2">No winner yet</h2>
              <p className="text-sm opacity-70 mt-1">Start swiping to cast your vote!</p>
            </>
          )}
        </div>
      </div>

      {/* Welcome & Quick Actions */}
      <div className="p-4 pt-5">
        <h1 className="text-lg font-bold mb-4">
          Welcome back{user ? `, ${user.display_name}` : ''}!
        </h1>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/swipe" className="flex flex-col items-center gap-2 p-4 bg-brand-50 rounded-2xl hover:bg-brand-100 transition-colors">
            <span className="text-2xl">{'\u2764\ufe0f'}</span>
            <span className="text-sm font-medium text-brand-700">Rate Dogs</span>
          </Link>
          <Link to="/dogs" className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
            <span className="text-2xl">{'\ud83d\udc36'}</span>
            <span className="text-sm font-medium text-gray-700">My Dogs</span>
          </Link>
          <Link to="/lost" className="flex flex-col items-center gap-2 p-4 bg-red-50 rounded-2xl hover:bg-red-100 transition-colors">
            <span className="text-2xl">{'\ud83d\udea8'}</span>
            <span className="text-sm font-medium text-red-700">Lost & Found</span>
          </Link>
          <Link to="/parks" className="flex flex-col items-center gap-2 p-4 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors">
            <span className="text-2xl">{'\ud83c\udf33'}</span>
            <span className="text-sm font-medium text-green-700">Dog Parks</span>
          </Link>
          <Link to="/rescues" className="flex flex-col items-center gap-2 p-4 bg-purple-50 rounded-2xl hover:bg-purple-100 transition-colors col-span-2">
            <span className="text-2xl">{'\ud83c\udfe0'}</span>
            <span className="text-sm font-medium text-purple-700">Rescue Organizations</span>
          </Link>
        </div>

        <Link to="/rankings" className="block mt-3">
          <Button variant="secondary" className="w-full">
            {'\ud83c\udfc6'} View Rankings
          </Button>
        </Link>
      </div>
    </div>
  );
}
