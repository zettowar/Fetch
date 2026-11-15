import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { getCurrentRankings, getWinnerHistory } from '../api/rankings';
import { getMyPets } from '../api/pets';
import SpeciesTabs from '../components/SpeciesTabs';
import { useSpeciesFilter, filterToSpecies } from '../hooks/useSpeciesFilter';
import { ListSkeleton } from '../components/ui/Skeleton';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import BrandIcon from '../components/brand/BrandIcon';
import PetPortrait from '../components/brand/PetPortrait';
import RankMedal, { Crown } from '../components/brand/RankMedal';
import type { LeaderboardEntry } from '../types';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../store/AuthContext';
import { useWeeklyResetCountdown } from '../utils/weeklyReset';
import { useDocumentTitle } from '../utils/useDocumentTitle';

/**
 * One step of the podium. Only first place gets gold — a Crown Gold block and
 * the crown — everyone else stands on plain white (Brand Book, The app →
 * Rankings).
 */
function PodiumStep({ entry, mine }: { entry: LeaderboardEntry; mine: boolean }) {
  const first = entry.rank === 1;
  const height = first ? 'h-16' : entry.rank === 2 ? 'h-11' : 'h-8';
  return (
    <Link to={`/app/pets/${entry.pet_id}`} className="group flex min-w-0 flex-col items-center text-center">
      <span className="relative inline-flex">
        <span
          className={`block overflow-hidden rounded-full border-2 border-navy dark:border-white/30 ${
            first ? 'h-16 w-16 ring-4 ring-gold-500' : 'h-12 w-12'
          }`}
        >
          <PetPortrait species={entry.species} breed={entry.breed} seed={entry.pet_id} crop="face" background className="h-full w-full" />
        </span>
        {first && <Crown className="absolute -top-6 left-1/2 w-9 -translate-x-1/2 -rotate-6" />}
      </span>
      <p className="mt-1.5 w-full truncate text-sm font-extrabold text-navy dark:text-biscuit">
        {entry.pet_name}
        {mine && <span className="sr-only"> (yours)</span>}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-300">
        {entry.score} {first ? (entry.score === 1 ? 'like' : 'likes') : ''}
      </p>
      <span
        className={`mt-1.5 flex w-full items-center justify-center rounded-t-xl border-2 border-b-0 border-navy font-display text-2xl leading-none text-navy dark:border-white/20 ${height} ${
          first ? 'bg-gold-500 text-[28px]' : 'bg-white dark:bg-night-raised dark:text-biscuit'
        }`}
        aria-label={`Rank ${entry.rank}`}
      >
        {entry.rank}
      </span>
    </Link>
  );
}

export default function RankingsPage() {
  useDocumentTitle('Rankings · Fetchpawz');
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

  const podium = (leaderboard ?? []).filter((e) => e.rank <= 3);
  const showPodium = podium.length === 3;
  const rows = showPodium ? (leaderboard ?? []).filter((e) => e.rank > 3) : (leaderboard ?? []);
  const byRank = (r: number) => podium.find((e) => e.rank === r)!;

  return (
    <div className="p-4">
      <PageHeader
        title="Rankings"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <BrandIcon name="clock" size={15} /> This week resets in {resetsIn}
          </span>
        }
        className="mb-4"
      />

      <div className="flex justify-center mb-5">
        <SpeciesTabs />
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load the rankings." onRetry={() => refetch()} />
      ) : leaderboard && leaderboard.length > 0 ? (
        <>
          {showPodium && (
            <div className="grid grid-cols-[1fr_1.15fr_1fr] items-end gap-2 px-1 pt-6">
              <PodiumStep entry={byRank(2)} mine={myDogIds.has(byRank(2).pet_id.toString())} />
              <PodiumStep entry={byRank(1)} mine={myDogIds.has(byRank(1).pet_id.toString())} />
              <PodiumStep entry={byRank(3)} mine={myDogIds.has(byRank(3).pet_id.toString())} />
            </div>
          )}
          {rows.length > 0 && (
            <Card
              padding="none"
              className={`divide-y divide-gray-200 dark:divide-white/10 ${showPodium ? '!rounded-t-xl border-2 !border-navy dark:!border-white/20' : ''}`}
            >
              {rows.map((entry) => {
                const isMine = myDogIds.has(entry.pet_id.toString());
                return (
                  <Link
                    key={entry.pet_id}
                    to={`/app/pets/${entry.pet_id}`}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                      isMine
                        ? 'bg-brand-100 hover:bg-brand-200 dark:bg-brand-500/15 dark:hover:bg-brand-500/25'
                        : 'hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <RankMedal rank={entry.rank} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-extrabold text-navy dark:text-biscuit truncate">{entry.pet_name}</p>
                        {isMine && (
                          <span className="flex-shrink-0 rounded-full border-[1.5px] border-navy bg-brand-500 px-1.5 py-0.5 text-2xs font-extrabold uppercase tracking-wide text-navy">
                            You
                          </span>
                        )}
                      </div>
                      {entry.breed && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{entry.breed}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-navy dark:text-biscuit">{entry.score}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{entry.total_votes} votes</p>
                    </div>
                  </Link>
                );
              })}
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          illustration="sleeping"
          species={species}
          title="No votes yet this week"
          body="The leaderboard is still napping. Be the first to swipe."
          action={
            <Link to="/app/swipe" className="btn btn-primary btn-sm">
              Rate pets
            </Link>
          }
        />
      )}

      {history && history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit mb-2">Past winners</h2>
          <Card padding="none" className="divide-y divide-gray-200 dark:divide-white/10">
            {history.map((winner) => (
              <Link
                key={winner.id}
                to={`/app/pets/${winner.pet_id}`}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <Crown className="w-6 shrink-0" />
                <div className="flex-1">
                  <p className="font-extrabold text-navy dark:text-biscuit">{winner.pet_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Week of {winner.week_bucket}
                  </p>
                </div>
                <p className="font-extrabold text-navy dark:text-biscuit">{winner.score}</p>
              </Link>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
