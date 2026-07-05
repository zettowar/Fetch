import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getFeedback } from '../../api/admin';
import TimeAgo from '../../components/TimeAgo';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import { ListSkeleton } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';

export default function AdminFeedbackPage() {
  const [search, setSearch] = useState('');

  const { data: allFeedback = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: getFeedback,
  });

  const feedback = search
    ? allFeedback.filter((f) =>
        f.body.toLowerCase().includes(search.toLowerCase()) ||
        (f.screen_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : allFeedback;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Feedback ({allFeedback.length})</h1>
      </div>

      {allFeedback.length > 5 && (
        <SearchInput
          className="mb-4"
          placeholder="Search feedback..."
          value={search}
          onChange={setSearch}
        />
      )}

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load feedback." onRetry={() => refetch()} />
      ) : feedback.length === 0 ? (
        <EmptyState
          className="py-6"
          title={search ? 'No feedback matching your search' : 'No feedback yet'}
        />
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {feedback.map((f) => (
            <div key={f.id} className="p-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">{f.body}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                {f.screen_name && (
                  <Badge variant="neutral">{f.screen_name}</Badge>
                )}
                <Link to={`/app/users/${f.user_id}`} className="text-brand-500 hover:underline" target="_blank">
                  User
                </Link>
                <TimeAgo value={f.created_at} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
