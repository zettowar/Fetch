import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCurrentRankings, getWinnerHistory } from '../api/rankings';
import { ListSkeleton } from '../components/ui/Skeleton';

const RANK_EMOJI: Record<number, string> = { 1: '\ud83e\udd47', 2: '\ud83e\udd48', 3: '\ud83e\udd49' };

export default function RankingsPage() {
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['rankings', 'current'],
    queryFn: getCurrentRankings,
  });

  const { data: history } = useQuery({
    queryKey: ['rankings', 'history'],
    queryFn: () => getWinnerHistory(12),
  });

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{'\ud83c\udfc6'} Rankings</h1>

      <h2 className="text-lg font-semibold mb-2">This Week</h2>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : leaderboard && leaderboard.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 divide-y">
          {leaderboard.map((entry) => (
            <Link
              key={entry.dog_id}
              to={`/dogs/${entry.dog_id}`}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  entry.rank <= 3
                    ? 'bg-brand-100 text-brand-600'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {RANK_EMOJI[entry.rank] || entry.rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{entry.dog_name}</p>
                {entry.breed && (
                  <p className="text-xs text-gray-500 truncate">{entry.breed}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold text-brand-600">{entry.score}</p>
                <p className="text-xs text-gray-400">{entry.total_votes} votes</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <span className="text-3xl">{'\ud83d\udcca'}</span>
          <p className="text-gray-500 mt-2">No votes yet this week. Be the first to swipe!</p>
        </div>
      )}

      {history && history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Past Winners</h2>
          <div className="bg-white rounded-xl border border-gray-100 divide-y">
            {history.map((winner) => (
              <Link
                key={winner.id}
                to={`/dogs/${winner.dog_id}`}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg">{'\ud83c\udfc6'}</span>
                <div className="flex-1">
                  <p className="font-medium">{winner.dog_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">
                    Week of {winner.week_bucket}
                  </p>
                </div>
                <p className="font-semibold text-brand-600">{winner.score}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
