import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdoptionInquiries } from '../../api/admin';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import PaginationFooter from '../../components/ui/PaginationFooter';
import TimeAgo from '../../components/TimeAgo';

const PAGE_SIZE = 50;
const STATUSES = ['all', 'new', 'contacted', 'closed'];

export default function AdminInquiriesPage() {
  const [status, setStatus] = useState('all');
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inquiries', status, offset],
    queryFn: () => getAdoptionInquiries({ status: status === 'all' ? undefined : status, offset, limit: PAGE_SIZE }),
  });

  const items = data?.items ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Adoption inquiries</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Cross-rescue view of every adoption inquiry (read-only oversight).
      </p>

      <div className="flex gap-2 mb-3">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setOffset(0); }}
            className={`px-3 py-1 rounded-full text-sm capitalize ${
              status === s ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState className="py-6" title="No inquiries" />
      ) : (
        <Card as="ul" padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((inq) => (
            <li key={inq.id} className="p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{inq.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">→ {inq.rescue_name}</span>
                <Badge
                  className="uppercase ml-auto"
                  variant={inq.status === 'new' ? 'warning' : inq.status === 'contacted' ? 'info' : 'neutral'}
                >
                  {inq.status}
                </Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mt-1 break-words">{inq.message}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {inq.email}{inq.phone ? ` · ${inq.phone}` : ''} · <TimeAgo value={inq.created_at} />
              </p>
            </li>
          ))}
        </Card>
      )}

      <PaginationFooter offset={offset} pageSize={PAGE_SIZE} rendered={items.length} total={data?.total ?? 0} onChange={setOffset} />
    </div>
  );
}
