import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getAdminLostReports,
  closeLostReport,
  type AdminLostReport,
} from '../../api/admin';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import PaginationFooter from '../../components/ui/PaginationFooter';
import PageHeader from '../../components/ui/PageHeader';
import TimeAgo from '../../components/TimeAgo';
import { LINK, ROWS, segItem } from './adminStyles';
import { apiErrorMessage } from '../../utils/apiError';

const PAGE_SIZE = 50;

const STATUS_TABS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

// The calm register: a missing pet is the navy "missing" pill, a found one is
// green, and nothing in Lost & Found is ever danger red.
const KIND_LABELS: Record<string, string> = {
  missing: 'Missing',
  found: 'Found',
};

const KIND_VARIANTS: Record<string, 'missing' | 'success'> = {
  missing: 'missing',
  found: 'success',
};

const STATUS_VARIANTS: Record<string, 'info' | 'success' | 'neutral'> = {
  open: 'info',
  resolved: 'success',
  closed: 'neutral',
};

export default function AdminLostReportsPage() {
  const [statusFilter, setStatusFilter] = useState('open');
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();

  const { data: page, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-lost-reports', statusFilter, offset],
    queryFn: () => getAdminLostReports({ status: statusFilter, offset, limit: PAGE_SIZE }),
    staleTime: 2 * 60 * 1000,
  });
  // Memoised: `?? []` makes a fresh array on every render while the query is
  // loading, which re-ran the counts memo below each time.
  const reports = useMemo(() => page?.items ?? [], [page]);
  const total = page?.total ?? 0;

  const closeMutation = useMutation({
    mutationFn: closeLostReport,
    onSuccess: () => {
      toast.success('Report closed');
      queryClient.invalidateQueries({ queryKey: ['admin-lost-reports'] });
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Failed to close report')),
  });

  const { missingCount, foundCount } = useMemo(() => ({
    missingCount: reports.filter((r: AdminLostReport) => r.kind === 'missing').length,
    foundCount: reports.filter((r: AdminLostReport) => r.kind === 'found').length,
  }), [reports]);

  return (
    <div>
      <PageHeader plain title="Lost & Found reports" className="mb-5" />

      <div className="seg mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setOffset(0); }}
            className={segItem(statusFilter === tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!isError && reports.length > 0 && (
        <div className="flex gap-3 mb-3 text-xs font-semibold text-gray-600 dark:text-gray-300">
          <span className="font-mono font-normal text-gray-500 dark:text-gray-400">{total} total</span>
          {missingCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-brand-500" />
              {missingCount} missing (page)
            </span>
          )}
          {foundCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-success-500" />
              {foundCount} found (page)
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load lost & found reports." onRetry={() => refetch()} />
      ) : reports.length === 0 ? (
        <EmptyState className="py-6" title={statusFilter === 'all' ? 'No reports yet' : `No ${statusFilter} reports`} />
      ) : (
        <Card padding="none" className={ROWS}>
          {reports.map((report: AdminLostReport) => (
            <div key={report.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-navy dark:text-biscuit">
                      {KIND_VARIANTS[report.kind] ? (
                        <Badge variant={KIND_VARIANTS[report.kind]}>{KIND_LABELS[report.kind]}</Badge>
                      ) : (
                        report.kind
                      )}
                      {report.pet_name && (
                        <span className="ml-1">— {report.pet_name}</span>
                      )}
                    </span>
                    <Badge variant={STATUS_VARIANTS[report.status] ?? 'neutral'}>
                      {report.status}
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                    {report.description}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-2xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span>
                      Reporter:{' '}
                      <Link
                        to={`/app/users/${report.reporter_id}`}
                        target="_blank"
                        className={LINK}
                      >
                        {report.reporter_name ?? 'Unknown'}
                      </Link>
                    </span>
                    {report.pet_id && (
                      <span>
                        Pet:{' '}
                        <Link
                          to={`/app/pets/${report.pet_id}`}
                          target="_blank"
                          className={LINK}
                        >
                          {report.pet_name ?? report.pet_id.slice(0, 8)}
                        </Link>
                      </span>
                    )}
                    <span className="ml-auto font-mono"><TimeAgo value={report.created_at} /></span>
                  </div>
                </div>

                {report.status === 'open' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={closeMutation.isPending}
                    onClick={() => {
                      if (confirm('Close this lost report?')) {
                        closeMutation.mutate(report.id);
                      }
                    }}
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      {!isError && (
        <PaginationFooter
          offset={offset}
          pageSize={PAGE_SIZE}
          rendered={reports.length}
          total={total}
          onChange={setOffset}
        />
      )}
    </div>
  );
}
