import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdoptionInquiries } from '../../api/admin';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import PaginationFooter from '../../components/ui/PaginationFooter';
import PageHeader from '../../components/ui/PageHeader';
import TimeAgo from '../../components/TimeAgo';
import { ROWS, segItem } from './adminStyles';

const PAGE_SIZE = 50;
const STATUSES = ['all', 'new', 'contacted', 'closed'];

export default function AdminInquiriesPage() {
  const [status, setStatus] = useState('all');
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-inquiries', status, offset],
    queryFn: () => getAdoptionInquiries({ status: status === 'all' ? undefined : status, offset, limit: PAGE_SIZE }),
  });

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Adoption inquiries"
        subtitle="Cross-rescue view of every adoption inquiry (read-only oversight)."
        className="mb-5"
      />

      <div className="seg mb-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setOffset(0); }}
            className={`capitalize ${segItem(status === s)}`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load inquiries." onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState className="py-6" title="No inquiries" />
      ) : (
        <Card as="ul" padding="none" className={ROWS}>
          {items.map((inq) => (
            <li key={inq.id} className="p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold text-navy dark:text-biscuit">{inq.name}</span>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">→ {inq.rescue_name}</span>
                <Badge
                  className="uppercase ml-auto"
                  variant={inq.status === 'new' ? 'warning' : inq.status === 'contacted' ? 'info' : 'neutral'}
                >
                  {inq.status}
                </Badge>
              </div>
              <p className="text-gray-700 dark:text-gray-200 mt-1 break-words">{inq.message}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {inq.email}{inq.phone ? ` · ${inq.phone}` : ''} · <TimeAgo value={inq.created_at} className="font-mono" />
              </p>
            </li>
          ))}
        </Card>
      )}

      {!isError && (
        <PaginationFooter offset={offset} pageSize={PAGE_SIZE} rendered={items.length} total={data?.total ?? 0} onChange={setOffset} />
      )}
    </div>
  );
}
