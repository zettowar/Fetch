import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getDonations, refundDonation } from '../../api/admin';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import PaginationFooter from '../../components/ui/PaginationFooter';
import PageHeader from '../../components/ui/PageHeader';
import TimeAgo from '../../components/TimeAgo';
import { ROWS, ROW_HOVER, STAT_INK, STAT_NUMBER, segItem } from './adminStyles';

const PAGE_SIZE = 50;

function money(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'usd' });
}

const STATUSES = ['all', 'succeeded', 'pending', 'refunded', 'failed'];

export default function AdminDonationsPage() {
  const [status, setStatus] = useState('succeeded');
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-donations', status, offset],
    queryFn: () => getDonations({ status: status === 'all' ? undefined : status, offset, limit: PAGE_SIZE }),
  });

  const refund = useMutation({
    mutationFn: refundDonation,
    onSuccess: (r) => {
      toast.success(`Refunded ${money(r.amount_cents)}`);
      queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Refund failed');
    },
  });

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader title="Donations" className="mb-5" />

      {/* Succeeded totals. The totals and the list come from one request, so
          a failure shows a single error here and the list below stays empty
          rather than claiming "No donations". */}
      {isError ? (
        <ErrorState message="Couldn't load donations." onRetry={() => refetch()} />
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Card>
            <p className={`${STAT_NUMBER} text-success-700 dark:text-success-400`}>
              {data ? money(data.succeeded_amount_cents) : '—'}
            </p>
            <p className="eyebrow mt-1.5">Total raised</p>
          </Card>
          <Card>
            <p className={`${STAT_NUMBER} ${STAT_INK}`}>{data?.succeeded_count ?? '—'}</p>
            <p className="eyebrow mt-1.5">Successful gifts</p>
          </Card>
          <Card>
            <p className={`${STAT_NUMBER} ${STAT_INK}`}>{data ? money(data.succeeded_fee_cents) : '—'}</p>
            <p className="eyebrow mt-1.5">Platform fees</p>
          </Card>
        </div>
      )}

      <div className="seg max-w-full overflow-x-auto scrollbar-none mb-4">
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
      ) : isError ? null : items.length === 0 ? (
        <EmptyState className="py-6" title="No donations" />
      ) : (
        <Card as="ul" padding="none" className={ROWS}>
          {items.map((d) => (
            <li key={d.id} className={`p-3 flex items-center gap-3 text-sm ${ROW_HOVER}`}>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-navy dark:text-biscuit">
                  <span className="tabular-nums">{money(d.amount_cents)}</span> · <span className="font-semibold text-gray-600 dark:text-gray-300">{d.recipient_name}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {d.recipient_type} · <TimeAgo value={d.created_at} className="font-mono" />
                  {d.message ? ` · "${d.message}"` : ''}
                </p>
              </div>
              <Badge
                className="uppercase"
                variant={d.status === 'succeeded' ? 'success' : d.status === 'refunded' ? 'neutral' : d.status === 'failed' ? 'danger' : 'warning'}
              >
                {d.status}
              </Badge>
              {d.status === 'succeeded' && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={refund.isPending && refund.variables === d.id}
                  onClick={() => {
                    if (confirm(`Refund this ${money(d.amount_cents)} donation to ${d.recipient_name}? The money goes back to the donor. This cannot be undone.`)) {
                      refund.mutate(d.id);
                    }
                  }}
                >
                  Refund
                </Button>
              )}
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
