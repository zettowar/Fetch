import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  listMyTransfers,
  acceptTransfer,
  declineTransfer,
  type DogTransfer,
} from '../api/dogTransfers';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import { Spinner } from '../components/ui/Skeleton';
import { apiErrorMessage } from '../utils/apiError';

export default function TransfersPage() {
  const queryClient = useQueryClient();
  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['my-transfers'],
    queryFn: listMyTransfers,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['my-transfers'] });
    queryClient.invalidateQueries({ queryKey: ['my-dogs'] });
  };

  const accept = useMutation({
    mutationFn: (id: string) => acceptTransfer(id),
    onSuccess: () => {
      toast.success('Accepted — the dog is now yours 🎉');
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
    <div className="p-4 pb-8 max-w-xl mx-auto">
      <BackButton fallback="/home" />
      <h1 className="text-2xl font-bold mt-2 mb-1">Dog transfers</h1>
      <p className="text-sm text-gray-500 mb-5">
        When a rescue adopts one of their dogs to you, you'll see an invitation
        here. Accept to take ownership, or decline if this isn't you.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : pending.length === 0 && history.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📨</p>
          <p className="font-medium">No transfers</p>
          <p className="text-sm mt-1">You're all caught up.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Pending ({pending.length})
              </h2>
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
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                History
              </h2>
              <div className="flex flex-col gap-2">
                {history.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl"
                  >
                    {t.dog_photo_url && (
                      <img
                        src={t.dog_photo_url}
                        alt={t.dog_name ?? 'Dog'}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{t.dog_name}</p>
                      <p className="text-xs text-gray-400 capitalize">
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
    <div className="p-4 bg-white border border-brand-200 rounded-2xl">
      <div className="flex items-center gap-3 mb-3">
        {transfer.dog_photo_url && (
          <img
            src={transfer.dog_photo_url}
            alt={transfer.dog_name ?? 'Dog'}
            className="w-14 h-14 rounded-full object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{transfer.dog_name}</p>
          <p className="text-xs text-gray-500">
            From {transfer.from_rescue_name ?? 'a rescue'}
          </p>
          <p className="text-[11px] text-gray-400">
            Expires {new Date(transfer.expires_at).toLocaleDateString()}
          </p>
        </div>
        <Link
          to={`/dogs/${transfer.dog_id}`}
          className="text-xs text-brand-500 hover:underline"
        >
          View dog
        </Link>
      </div>
      <p className="text-sm text-gray-600 mb-3">
        Accepting takes ownership of <span className="font-medium">{transfer.dog_name}</span> on your account.
      </p>
      <div className="flex gap-2">
        <Button onClick={onAccept} loading={busy} className="flex-1">
          Accept
        </Button>
        <Button variant="ghost" onClick={onDecline} disabled={busy} className="flex-1">
          Decline
        </Button>
      </div>
    </div>
  );
}
