import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { HandCoins } from 'lucide-react';
import {
  getMyRescueProfile,
  markDogAdopted,
  transferDog,
} from '../api/rescues';
import {
  connectOnboard,
  getConnectStatus,
  getDonationConfig,
} from '../api/donations';
import { getMyDogs } from '../api/dogs';
import { listMyInquiries, updateInquiryStatus, type AdoptionInquiry } from '../api/adoption';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import { Spinner } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import BackButton from '../components/ui/BackButton';
import { useAuth } from '../store/AuthContext';
import { apiErrorMessage } from '../utils/apiError';
import type { Dog } from '../types';

export default function RescueDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['rescue-profile-me'],
    queryFn: getMyRescueProfile,
    enabled: user?.role === 'rescue',
    retry: false,
  });

  const approved = profile?.status === 'approved';

  const { data: dogs = [], refetch: refetchDogs } = useQuery<Dog[]>({
    queryKey: ['rescue-my-dogs'],
    queryFn: getMyDogs,
    enabled: approved,
  });

  const { data: inquiries = [], refetch: refetchInquiries } = useQuery<AdoptionInquiry[]>({
    queryKey: ['rescue-my-inquiries'],
    queryFn: listMyInquiries,
    enabled: approved,
  });

  if (user?.role !== 'rescue') {
    return (
      <div className="p-6">
        <BackButton fallback="/app/home" />
        <ErrorState message="This page is only for rescue accounts." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="p-6">
        <BackButton fallback="/app/home" />
        <ErrorState message="Could not load your rescue profile." />
      </div>
    );
  }

  if (profile.status === 'pending') {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-2">Application pending</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Thanks for applying, <span className="font-semibold">{profile.org_name}</span>.
          Our team is reviewing your application. Once approved, you'll be able to
          post adoptable dogs here.
        </p>
        <div className="rounded-xl bg-warning-50 border border-warning-200 dark:bg-warning-500/10 dark:border-warning-500/30 p-4 text-sm text-warning-800 dark:text-warning-200 mb-4">
          Reviews typically take 1–3 business days. We'll email you at your signup address.
        </div>
      </div>
    );
  }

  if (profile.status === 'rejected') {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-2">Application declined</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          {profile.review_note || "We couldn't verify your application."} Please
          reach out to us with additional information if you think this is a mistake.
        </p>
      </div>
    );
  }

  const unadopted = dogs.filter((d) => !d.adopted_at && d.is_active);
  const adopted = dogs.filter((d) => d.adopted_at);

  return (
    <div className="p-4 pb-8 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">{profile.org_name}</h1>
        <Link
          to="/app/dogs/new"
          className="text-sm font-medium text-brand-500 hover:text-brand-600"
        >
          + Post a dog
        </Link>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Dogs you post here appear in the swipe feed and the adoption directory.
      </p>

      <ConnectDonationsCard externalDonationUrl={profile.donation_url} />

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Adoptable ({unadopted.length})
        </h2>
        {unadopted.length === 0 ? (
          <EmptyState
            illustration="sleeping"
            title="No adoptable dogs yet"
            body={
              <>
                <Link to="/app/dogs/new" className="text-brand-500 hover:underline">
                  Post your first
                </Link>{' '}
                to get started.
              </>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {unadopted.map((d) => (
              <AdoptableDogRow
                key={d.id}
                dog={d}
                onChanged={() => {
                  refetchDogs();
                  queryClient.invalidateQueries({ queryKey: ['dog', d.id] });
                }}
                onView={() => navigate(`/app/dogs/${d.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Inquiries ({inquiries.length})
        </h2>
        {inquiries.length === 0 ? (
          <EmptyState
            illustration="sleeping"
            title="No adoption inquiries yet"
            body="They'll show up here when someone reaches out from your rescue page."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {inquiries.map((q) => (
              <InquiryRow key={q.id} inquiry={q} dogs={dogs} onChanged={refetchInquiries} />
            ))}
          </div>
        )}
      </section>

      {adopted.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Adopted ({adopted.length})
          </h2>
          <div className="flex flex-col gap-2">
            {adopted.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl"
              >
                {d.primary_photo_url && (
                  <img
                    src={d.primary_photo_url}
                    alt={d.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{d.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Adopted {d.adopted_at ? new Date(d.adopted_at).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AdoptableDogRow({
  dog,
  onChanged,
  onView,
}: {
  dog: Dog;
  onChanged: () => void;
  onView: () => void;
}) {
  const [mode, setMode] = useState<'idle' | 'transfer'>('idle');
  const [email, setEmail] = useState('');
  const markAdopted = useMutation({
    mutationFn: () => markDogAdopted(dog.id),
    onSuccess: () => {
      toast.success(`${dog.name} marked adopted`);
      onChanged();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to mark adopted')),
  });
  const transfer = useMutation({
    mutationFn: () => transferDog(dog.id, { invited_email: email.trim().toLowerCase() }),
    onSuccess: () => {
      toast.success(`Transfer sent to ${email}`);
      setMode('idle');
      setEmail('');
      onChanged();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Transfer failed')),
  });

  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        {dog.primary_photo_url && (
          <img
            src={dog.primary_photo_url}
            alt={dog.name}
            className="w-12 h-12 rounded-full object-cover cursor-pointer"
            onClick={onView}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{dog.name}</p>
          {dog.breed_display && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{dog.breed_display}</p>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onView}>
          View
        </Button>
      </div>
      {mode === 'idle' ? (
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => setMode('transfer')}
          >
            Transfer to adopter
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            onClick={() => {
              if (confirm(`Mark ${dog.name} as adopted? They'll stop appearing in the swipe feed.`)) {
                markAdopted.mutate();
              }
            }}
            loading={markAdopted.isPending}
          >
            Mark adopted
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <Input
            label="Adopter's email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="adopter@example.com"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            They'll see a pending transfer next time they log in. If they don't
            have Fetch yet, they'll see it when they sign up with this email.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => transfer.mutate()}
              loading={transfer.isPending}
              disabled={!email.trim()}
            >
              Send transfer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setMode('idle');
                setEmail('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

const STATUS_LABEL: Record<AdoptionInquiry['status'], string> = {
  new: 'New',
  contacted: 'Contacted',
  closed: 'Closed',
};
const STATUS_VARIANT: Record<AdoptionInquiry['status'], 'warning' | 'info' | 'neutral'> = {
  new: 'warning',
  contacted: 'info',
  closed: 'neutral',
};

function InquiryRow({
  inquiry,
  dogs,
  onChanged,
}: {
  inquiry: AdoptionInquiry;
  dogs: Dog[];
  onChanged: () => void;
}) {
  const mutation = useMutation({
    mutationFn: (next: AdoptionInquiry['status']) => updateInquiryStatus(inquiry.id, next),
    onSuccess: () => {
      toast.success('Inquiry updated');
      onChanged();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to update inquiry')),
  });

  const aboutDog = inquiry.dog_id ? dogs.find((d) => d.id === inquiry.dog_id) : undefined;

  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{inquiry.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            <a href={`mailto:${inquiry.email}`} className="hover:underline">{inquiry.email}</a>
            {inquiry.phone && ` · ${inquiry.phone}`}
          </p>
          <p className="text-2xs text-gray-400 dark:text-gray-500 mt-0.5">
            {new Date(inquiry.created_at).toLocaleString()}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[inquiry.status]} className="flex-shrink-0">
          {STATUS_LABEL[inquiry.status]}
        </Badge>
      </div>
      {aboutDog && (
        <Link
          to={`/app/dogs/${aboutDog.id}`}
          className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300 text-2xs font-medium hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors"
        >
          About {aboutDog.name} ↗
        </Link>
      )}
      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap">{inquiry.message}</p>
      <div className="flex gap-2 mt-3">
        {inquiry.status !== 'contacted' && (
          <Button size="sm" variant="secondary" onClick={() => mutation.mutate('contacted')} loading={mutation.isPending}>
            Mark contacted
          </Button>
        )}
        {inquiry.status !== 'closed' && (
          <Button size="sm" variant="ghost" onClick={() => mutation.mutate('closed')} loading={mutation.isPending}>
            Close
          </Button>
        )}
        {inquiry.status === 'closed' && (
          <Button size="sm" variant="ghost" onClick={() => mutation.mutate('new')} loading={mutation.isPending}>
            Reopen
          </Button>
        )}
      </div>
    </Card>
  );
}

function ConnectDonationsCard({ externalDonationUrl }: { externalDonationUrl: string | null }) {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  const { data: config } = useQuery({
    queryKey: ['donation-config'],
    queryFn: getDonationConfig,
    staleTime: 5 * 60_000,
  });
  const { data: status } = useQuery({
    queryKey: ['connect-status'],
    queryFn: getConnectStatus,
    enabled: !!config?.enabled,
  });

  // Back from Stripe onboarding: re-sync status and greet.
  useEffect(() => {
    const connect = params.get('connect');
    if (!connect) return;
    queryClient.invalidateQueries({ queryKey: ['connect-status'] });
    if (connect === 'return') toast.success('Welcome back — checking your Stripe setup…');
    params.delete('connect');
    setParams(params, { replace: true });
  }, [params, setParams, queryClient]);

  const onboard = useMutation({
    mutationFn: connectOnboard,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not start Stripe onboarding.')),
  });

  if (!config?.enabled) return null;

  return (
    <Card padding="md" className="mb-8">
      <div className="flex items-start gap-3">
        <span className="inline-flex w-9 h-9 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300" aria-hidden>
          <HandCoins size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">In-app donations</h2>
            {status?.charges_enabled ? (
              <Badge variant="success">Active</Badge>
            ) : status?.has_account ? (
              <Badge variant="warning">Onboarding incomplete</Badge>
            ) : null}
          </div>
          {status?.charges_enabled ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Supporters can donate to you right inside Fetch. Payouts go to your
              Stripe account.
            </p>
          ) : status?.has_account ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {status.details_submitted
                  ? 'Stripe is reviewing your details — this usually clears quickly.'
                  : 'Finish Stripe onboarding to start receiving in-app donations.'}
              </p>
              {!status.details_submitted && (
                <Button
                  size="sm"
                  className="mt-2"
                  loading={onboard.isPending}
                  onClick={() => onboard.mutate()}
                >
                  Resume onboarding
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Let supporters donate without leaving Fetch. Stripe handles
                identity checks and pays out straight to your bank (US accounts).
                {externalDonationUrl ? ' Your external donation link keeps working either way.' : ''}
              </p>
              <Button
                size="sm"
                className="mt-2"
                loading={onboard.isPending}
                onClick={() => onboard.mutate()}
              >
                Accept donations in-app
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
