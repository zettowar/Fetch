import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { getMyDonations, formatCents, type DonationStatus } from '../api/donations';
import BrandIcon from '../components/brand/BrandIcon';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';
import { ListSkeleton } from '../components/ui/Skeleton';
import { relativeTime } from '../utils/time';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { useSectionOpen } from '../hooks/usePublicFlags';

const STATUS_BADGE: Record<DonationStatus, { variant: 'success' | 'neutral' | 'warning' | 'danger'; label: string }> = {
  succeeded: { variant: 'success', label: 'Received' },
  pending: { variant: 'neutral', label: 'Processing' },
  failed: { variant: 'warning', label: 'Not completed' },
  refunded: { variant: 'danger', label: 'Refunded' },
};

// Platform gifts wear Ball Orange; gifts to a rescue wear Forever Pink.
const ORANGE_BEAN = { '--bean': 'var(--orange)' } as CSSProperties;

export default function DonationHistoryPage() {
  useDocumentTitle('My donations · Fetchpawz');
  const donateOpen = useSectionOpen('explore_donate_enabled');
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
            donateOpen ? (
              <Link to="/app/donate" className="btn btn-primary btn-sm">
                Donate
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card padding="none" as="ul" className="divide-y divide-gray-200 dark:divide-white/10">
          {donations.map((d) => {
            const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.pending;
            return (
              <li key={d.id} className="flex items-center gap-3 p-3">
                <span
                  className={`inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-full border-2 border-navy text-navy dark:border-white/15 dark:text-biscuit ${
                    d.recipient_type === 'platform'
                      ? 'bg-brand-100 dark:bg-brand-500/20'
                      : 'bg-pink-100 dark:bg-pink-500/20'
                  }`}
                  aria-hidden
                >
                  {d.recipient_type === 'platform' ? (
                    <BrandIcon name="donate" size={20} style={ORANGE_BEAN} />
                  ) : (
                    <BrandIcon name="rescue" size={20} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-navy dark:text-biscuit truncate">
                    {d.recipient_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {relativeTime(d.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="mb-1 text-sm font-extrabold tabular-nums text-navy dark:text-biscuit">
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
