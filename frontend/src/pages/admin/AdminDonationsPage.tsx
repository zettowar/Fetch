import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getDonations, refundDonation } from '../../api/admin';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import PaginationFooter from '../../components/ui/PaginationFooter';
import TimeAgo from '../../components/TimeAgo';

const PAGE_SIZE = 50;

function money(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'usd' });
}

const STATUSES = ['all', 'succeeded', 'pending', 'refunded', 'failed'];

export default function AdminDonationsPage() {
  const [status, setStatus] = useState('succeeded');
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
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
      <h1 className="text-2xl font-bold mb-4">Donations</h1>

      {/* Succeeded totals */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400">
            {data ? money(data.succeeded_amount_cents) : '—'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total raised</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold">{data?.succeeded_count ?? '—'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Successful gifts</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold">{data ? money(data.succeeded_fee_cents) : '—'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Platform fees</p>
        </Card>
      </div>

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
        <EmptyState className="py-6" title="No donations" />
      ) : (
        <Card as="ul" padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((d) => (
            <li key={d.id} className="p-3 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {money(d.amount_cents)} · <span className="text-gray-500 dark:text-gray-400">{d.recipient_name}</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {d.recipient_type} · <TimeAgo value={d.created_at} />
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
                    if (confirm(`Refund ${money(d.amount_cents)} to ${d.recipient_name}? This cannot be undone.`)) {
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

      <PaginationFooter offset={offset} pageSize={PAGE_SIZE} rendered={items.length} total={data?.total ?? 0} onChange={setOffset} />
    </div>
  );
}
