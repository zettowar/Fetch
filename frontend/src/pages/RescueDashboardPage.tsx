import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getMyRescueProfile,
  markDogAdopted,
  transferDog,
} from '../api/rescues';
import { getMyDogs } from '../api/dogs';
import Button from '../components/ui/Button';
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

  if (user?.role !== 'rescue') {
    return (
      <div className="p-6">
        <BackButton fallback="/home" />
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
        <BackButton fallback="/home" />
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
        <div className="rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 p-4 text-sm text-amber-800 dark:text-amber-200 mb-4">
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
          to="/dogs/new"
          className="text-sm font-medium text-brand-500 hover:text-brand-600"
        >
          + Post a dog
        </Link>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Dogs you post here appear in the swipe feed and the adoption directory.
      </p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Adoptable ({unadopted.length})
        </h2>
        {unadopted.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No adoptable dogs yet —{' '}
            <Link to="/dogs/new" className="text-brand-500 hover:underline">
              post your first
            </Link>.
          </p>
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
                onView={() => navigate(`/dogs/${d.id}`)}
              />
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
    <div className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl">
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
    </div>
  );
}
