import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { getCurrentRankings, getWinnerHistory } from '../api/rankings';
import { getMyPets } from '../api/pets';
import SpeciesTabs from '../components/SpeciesTabs';
import { useSpeciesFilter, filterToSpecies } from '../hooks/useSpeciesFilter';
import { ListSkeleton } from '../components/ui/Skeleton';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../store/AuthContext';
import { useWeeklyResetCountdown } from '../utils/weeklyReset';

const RANK_EMOJI: Record<number, string> = { 1: '\ud83e\udd47', 2: '\ud83e\udd48', 3: '\ud83e\udd49' };

export default function RankingsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useSpeciesFilter();
  const species = filterToSpecies(filter);

  // Honor a ?species= deep-link (e.g. tapping the Top Cat crown on the home dashboard).
  useEffect(() => {
    const sp = searchParams.get('species');
    if (sp === 'dog' || sp === 'cat') setFilter(sp);
  }, [searchParams, setFilter]);

  const { data: leaderboard, isLoading, isError, refetch } = useQuery({
    queryKey: ['rankings', 'current', filter],
    queryFn: () => getCurrentRankings(species),
  });

  const { data: history } = useQuery({
    queryKey: ['rankings', 'history', filter],
    queryFn: () => getWinnerHistory(12, species),
  });

  const { data: myDogs } = useQuery({
    queryKey: ['my-pets'],
    queryFn: getMyPets,
    enabled: !!user,
  });

  const myDogIds = new Set((myDogs ?? []).map((d) => d.id.toString()));

  const resetsIn = useWeeklyResetCountdown();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold tracking-tight mb-4 flex items-center gap-2">
        <Trophy size={22} aria-hidden className="text-warning-500" /> Rankings
      </h1>

      <div className="flex justify-center mb-4">
        <SpeciesTabs />
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-semibold">This Week</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">Resets in {resetsIn}</span>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load the rankings." onRetry={() => refetch()} />
      ) : leaderboard && leaderboard.length > 0 ? (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {leaderboard.map((entry) => {
            const isMine = myDogIds.has(entry.pet_id.toString());
            return (
            <Link
              key={entry.pet_id}
              to={`/app/pets/${entry.pet_id}`}
              className={`flex items-center gap-3 p-3 transition-colors ${
                isMine
                  ? 'bg-brand-50 dark:bg-brand-500/10 ring-1 ring-inset ring-brand-200 dark:ring-brand-500/40 hover:bg-brand-100 dark:hover:bg-brand-500/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
              }`}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  entry.rank <= 3
                    ? 'bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}
              >
                {RANK_EMOJI[entry.rank] || entry.rank}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium truncate">{entry.pet_name}</p>
                  {isMine && (
                    <span className="flex-shrink-0 text-2xs font-semibold uppercase tracking-wide bg-brand-500 text-white px-1.5 py-0.5 rounded-full">
                      You
                    </span>
                  )}
                </div>
                {entry.breed && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{entry.breed}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold text-brand-600">{entry.score}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{entry.total_votes} votes</p>
              </div>
            </Link>
            );
          })}
        </Card>
      ) : (
        <EmptyState
          illustration="sleeping"
          species={species}
          title="No votes yet this week"
          body="The leaderboard is still napping — be the first to swipe!"
        />
      )}

      {history && history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Past Winners</h2>
          <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
            {history.map((winner) => (
              <Link
                key={winner.id}
                to={`/app/pets/${winner.pet_id}`}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <Trophy size={18} aria-hidden className="text-warning-500" />
                <div className="flex-1">
                  <p className="font-medium">{winner.pet_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Week of {winner.week_bucket}
                  </p>
                </div>
                <p className="font-semibold text-brand-600">{winner.score}</p>
              </Link>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
