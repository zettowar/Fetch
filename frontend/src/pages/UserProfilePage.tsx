import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import TimeAgo from '../components/TimeAgo';
import { Spinner } from '../components/ui/Skeleton';
import DogProfileCard from '../components/DogProfileCard';
import { getUserProfile } from '../api/social';
import { getDogsByUser } from '../api/dogs';
import { resendVerification } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { shareLink } from '../utils/shareLink';

export default function UserProfilePage() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [debugToken, setDebugToken] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', id],
    queryFn: () => getUserProfile(id!),
    enabled: !!id,
  });

  const { data: dogs = [], isLoading: dogsLoading } = useQuery({
    queryKey: ['user-dogs', id],
    queryFn: () => getDogsByUser(id!),
    enabled: !!id,
  });

  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: (data) => {
      if (data.debug_token) {
        setDebugToken(data.debug_token);
        toast.success('Verification email sent (dev token below)');
      } else {
        toast.success('Verification email sent');
      }
    },
    onError: () => toast.error('Could not send verification email'),
  });

  useDocumentTitle(profile ? `${profile.display_name} · Fetch` : null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!profile) return <div className="p-4 text-gray-500">User not found</div>;

  const isMe = currentUser?.id === profile.id;

  const handleShare = () => {
    const url = `${window.location.origin}/users/${profile.id}`;
    shareLink(url, `${profile.display_name} on Fetch`);
  };

  return (
    <div className="pb-6">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3">
        <BackButton />
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          aria-label="Share profile"
        >
          <span aria-hidden>↗</span>
          Share
        </button>
      </div>

      {/* Header */}
      <section className="flex flex-col items-center text-center px-6 pt-2 pb-6">
        <div className="rounded-full p-1 bg-gradient-to-br from-brand-300 via-brand-400 to-brand-600 shadow-soft">
          <div className="rounded-full bg-white p-1">
            <Avatar name={profile.display_name} size="2xl" />
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{profile.display_name}</h1>
        {profile.location_rough && (
          <p className="mt-0.5 text-sm text-gray-500">{profile.location_rough}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          Joined <TimeAgo value={profile.created_at} />
        </p>
      </section>

      {/* Stats strip */}
      <section className="mx-4 mb-5 grid grid-cols-2 rounded-2xl bg-gray-50 border border-gray-100 divide-x divide-gray-100 overflow-hidden">
        <div className="py-3 text-center">
          <p className="text-xl font-bold text-gray-900 tabular-nums">{profile.dog_count}</p>
          <p className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">
            {profile.dog_count === 1 ? 'Dog' : 'Dogs'}
          </p>
        </div>
        <div className="py-3 text-center">
          <p className="text-xl font-bold text-gray-900 tabular-nums">{profile.follower_count}</p>
          <p className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">
            {profile.follower_count === 1 ? 'Follower' : 'Followers'}
          </p>
        </div>
      </section>

      {/* Verify banner (self only) */}
      {isMe && currentUser && !currentUser.is_verified && (
        <section className="mx-4 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-amber-800">Email not verified</p>
              <p className="text-xs text-amber-700 mt-0.5 break-words">
                Verify <span className="font-mono">{currentUser.email}</span> so we can reach you about account and safety updates.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={resendMutation.isPending}
              onClick={() => resendMutation.mutate()}
            >
              Resend
            </Button>
          </div>
          {debugToken && (
            <div className="mt-2 p-2 bg-white border border-amber-200 rounded-lg">
              <p className="text-[11px] text-amber-700 mb-1">
                Dev mode: no SMTP configured. Use this link to verify:
              </p>
              <Link
                to={`/verify-email/${debugToken}`}
                className="text-xs text-brand-500 break-all hover:underline"
              >
                {window.location.origin}/verify-email/{debugToken}
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Account menu (self only) */}
      {isMe && (
        <section className="mx-4 mb-6 flex flex-col gap-2">
          <MenuLink to="/profile/edit" label="Edit profile" icon="✏️" />
          <MenuLink to="/following" label="Dogs I follow" icon="🐾" />
          <MenuLink to="/notifications" label="Notifications" icon="🔔" />
        </section>
      )}

      {/* Dogs grid */}
      <section className="mx-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-bold tracking-tight">
            {isMe ? 'My dogs' : `${profile.display_name.split(' ')[0]}'s dogs`}
          </h2>
          {isMe && (
            <Link
              to="/dogs/new"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              + Add dog
            </Link>
          )}
        </div>

        {dogsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : dogs.length === 0 ? (
          <div className="rounded-2xl bg-gray-50 border border-gray-100 py-10 px-6 text-center">
            <p className="text-3xl mb-2" aria-hidden>🐶</p>
            <p className="text-sm text-gray-600 font-medium">
              {isMe ? 'No dogs yet' : "Hasn't added any dogs yet"}
            </p>
            {isMe && (
              <Link
                to="/dogs/new"
                className="inline-block mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Add your first dog →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {dogs.map((dog) => (
              <DogProfileCard key={dog.id} dog={dog} showEdit={isMe} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MenuLink({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl text-sm shadow-soft-sm hover:border-gray-200 hover:shadow-soft transition-all duration-150"
    >
      <span className="text-lg leading-none" aria-hidden>{icon}</span>
      <span className="flex-1 font-medium text-gray-700">{label}</span>
      <span className="text-gray-300">›</span>
    </Link>
  );
}
