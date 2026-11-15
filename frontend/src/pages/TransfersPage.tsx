import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  listMyTransfers,
  acceptTransfer,
  declineTransfer,
  type DogTransfer,
} from '../api/petTransfers';
import BrandIcon from '../components/brand/BrandIcon';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';
import SectionHeader from '../components/ui/SectionHeader';
import { ListSkeleton } from '../components/ui/Skeleton';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function TransfersPage() {
  useDocumentTitle('Pet transfers · Fetchpawz');
  const queryClient = useQueryClient();
  const { data: transfers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my-transfers'],
    queryFn: listMyTransfers,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['my-transfers'] });
    queryClient.invalidateQueries({ queryKey: ['my-pets'] });
  };

  const accept = useMutation({
    mutationFn: (id: string) => acceptTransfer(id),
    onSuccess: () => {
      toast.success('Accepted — the pet is now yours.');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not accept')),
  });
  const decline = useMutation({
    mutationFn: (id: string) => declineTransfer(id),
    onSuccess: () => {
      toast('Declined.');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not decline')),
  });

  const pending = transfers.filter((t) => t.status === 'pending');
  const history = transfers.filter((t) => t.status !== 'pending');

  return (
    // sm:max-w-none: from `sm` the shell's column sets the width, so the
    // title lines up with every other column page instead of sitting inset.
    <div className="p-4 pb-8 max-w-xl mx-auto sm:max-w-none">
      <PageHeader
        title="Pet transfers"
        back
        backFallback="/app/home"
        className="mb-5"
        subtitle={
          <>
            When a rescue adopts one of their pets to you, you'll see an invitation
            here. Accept to take ownership, or decline if this isn't you.
          </>
        }
      />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        // A failed fetch is not "no transfers" — someone waiting on a pet
        // must not be told they're all caught up.
        <ErrorState message="Couldn't load your transfers." onRetry={() => refetch()} />
      ) : pending.length === 0 && history.length === 0 ? (
        <EmptyState
          illustration="sleeping"
          title="No transfers"
          body="You're all caught up."
        />
      ) : (
        <>
          {pending.length > 0 && (
            <section className="mb-6">
              <SectionHeader title={`Pending (${pending.length})`} />
              <div className="flex flex-col gap-3">
                {pending.map((t) => (
                  <TransferCard
                    key={t.id}
                    transfer={t}
                    onAccept={() => accept.mutate(t.id)}
                    onDecline={() => decline.mutate(t.id)}
                    busy={accept.isPending || decline.isPending}
                  />
                ))}
              </div>
            </section>
          )}
          {history.length > 0 && (
            <section>
              <SectionHeader title="History" />
              <div className="flex flex-col gap-2">
                {history.map((t) => (
                  <div
                    key={t.id}
                    className="surface flex items-center gap-3 p-3"
                  >
                    {t.pet_photo_url ? (
                      <img
                        src={t.pet_photo_url}
                        alt={t.pet_name ?? 'Pet'}
                        className="w-10 h-10 rounded-full object-cover border-2 border-navy dark:border-white/15"
                      />
                    ) : (
                      // The transfer doesn't carry the pet's species, so no
                      // breed portrait: a rescue mark stands in.
                      <span
                        className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-pink-100 text-navy dark:border-white/15 dark:bg-pink-500/20 dark:text-biscuit"
                        aria-hidden
                      >
                        <BrandIcon name="rescue" size={18} />
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-navy dark:text-biscuit truncate">{t.pet_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {t.status}{t.from_rescue_name ? ` · ${t.from_rescue_name}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TransferCard({
  transfer,
  onAccept,
  onDecline,
  busy,
}: {
  transfer: DogTransfer;
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  return (
    <div className="p-4 bg-white dark:bg-night-surface border-2 border-pink-500 dark:border-pink-400/60 rounded-2xl">
      <div className="flex items-center gap-3 mb-3">
        {transfer.pet_photo_url ? (
          <img
            src={transfer.pet_photo_url}
            alt={transfer.pet_name ?? 'Pet'}
            className="w-14 h-14 rounded-full object-cover border-2 border-navy dark:border-white/15"
          />
        ) : (
          <span
            className="flex w-14 h-14 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-pink-100 text-navy dark:border-white/15 dark:bg-pink-500/20 dark:text-biscuit"
            aria-hidden
          >
            <BrandIcon name="rescue" size={26} />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-display text-2xl leading-none text-navy dark:text-biscuit truncate">{transfer.pet_name}</p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            From {transfer.from_rescue_name ?? 'a rescue'}
          </p>
          <p className="text-2xs text-gray-500 dark:text-gray-400">
            Expires {new Date(transfer.expires_at).toLocaleDateString()}
          </p>
        </div>
        <Link to={`/app/pets/${transfer.pet_id}`} className="btn btn-ghost btn-sm shrink-0">
          View pet
        </Link>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
        Accepting takes ownership of <span className="font-extrabold text-navy dark:text-biscuit">{transfer.pet_name}</span> on your account.
      </p>
      <div className="flex gap-2">
        <Button variant="rescue" onClick={onAccept} loading={busy} className="flex-1">
          Accept
        </Button>
        <Button variant="ghost" onClick={onDecline} disabled={busy} className="flex-1">
          Decline
        </Button>
      </div>
    </div>
  );
}
