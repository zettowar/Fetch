import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { HeartHandshake, HousePlus } from 'lucide-react';
import { getMyDonations, formatCents, type DonationStatus } from '../api/donations';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';
import { ListSkeleton } from '../components/ui/Skeleton';
import { relativeTime } from '../utils/time';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const STATUS_BADGE: Record<DonationStatus, { variant: 'success' | 'neutral' | 'warning' | 'danger'; label: string }> = {
  succeeded: { variant: 'success', label: 'Received' },
  pending: { variant: 'neutral', label: 'Processing' },
  failed: { variant: 'warning', label: 'Not completed' },
  refunded: { variant: 'danger', label: 'Refunded' },
};

export default function DonationHistoryPage() {
  useDocumentTitle('My donations · Fetchpawz');
  const { data: donations, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-donations'],
    queryFn: getMyDonations,
  });

  return (
    <div className="p-4 flex flex-col gap-4">
      <PageHeader title="My donations" back backFallback="/app/home" />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <ErrorState message="Couldn't load your donations." onRetry={refetch} />
      ) : !donations || donations.length === 0 ? (
        <EmptyState
          illustration="sleeping"
          title="No donations yet"
          body="Chip in for the rescues doing the hard work — or toss Fetchpawz a bone."
          action={
            <Link to="/app/donate">
              <Button size="sm">Donate</Button>
            </Link>
          }
        />
      ) : (
        <Card padding="none" as="ul" className="divide-y divide-gray-100 dark:divide-gray-800">
          {donations.map((d) => {
            const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.pending;
            return (
              <li key={d.id} className="flex items-center gap-3 p-3">
                <span
                  className={`inline-flex w-9 h-9 shrink-0 items-center justify-center rounded-full ${
                    d.recipient_type === 'platform'
                      ? 'bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300'
                      : 'bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-300'
                  }`}
                  aria-hidden
                >
                  {d.recipient_type === 'platform' ? (
                    <HeartHandshake size={18} />
                  ) : (
                    <HousePlus size={18} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {d.recipient_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {relativeTime(d.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatCents(d.amount_cents)}
                  </p>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
              </li>
            );
          })}
        </Card>
      )}
    </div>
  );
}
