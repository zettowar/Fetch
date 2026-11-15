import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { searchFeedback } from '../../api/admin';
import TimeAgo from '../../components/TimeAgo';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import PaginationFooter from '../../components/ui/PaginationFooter';
import { ListSkeleton } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import PageHeader from '../../components/ui/PageHeader';
import { LINK, ROWS } from './adminStyles';

const PAGE_SIZE = 100;

export default function AdminFeedbackPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const { data: page, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-feedback', search, offset],
    queryFn: () => searchFeedback({ q: search, offset, limit: PAGE_SIZE }),
  });

  const feedback = page?.items ?? [];
  const total = page?.total ?? 0;

  return (
    <div>
      <PageHeader title={isError || isLoading ? 'Feedback' : `Feedback (${total})`} className="mb-5" />

      <form
        onSubmit={(e) => { e.preventDefault(); setSearch(query); setOffset(0); }}
        className="mb-4 flex gap-2"
      >
        <SearchInput
          className="flex-1"
          placeholder="Search feedback..."
          value={query}
          onChange={setQuery}
        />
      </form>

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
        <Card padding="none" className={ROWS}>
          {feedback.map((f) => (
            <div key={f.id} className="p-3">
              <p className="text-sm text-navy dark:text-biscuit">{f.body}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {f.screen_name && (
                  <Badge variant="neutral" className="font-mono">{f.screen_name}</Badge>
                )}
                <Link to={`/app/users/${f.user_id}`} className={LINK} target="_blank">
                  User
                </Link>
                <TimeAgo value={f.created_at} className="font-mono" />
              </div>
            </div>
          ))}
        </Card>
      )}

      <PaginationFooter offset={offset} pageSize={PAGE_SIZE} rendered={feedback.length} total={total} onChange={setOffset} />
    </div>
  );
}
