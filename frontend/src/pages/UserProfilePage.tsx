import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeftRight,
  Bell,
  ChevronRight,
  Heart,
  HeartHandshake,
  PawPrint,
  Pencil,
  Share2,
  Ticket,
} from 'lucide-react';
import type { ReactNode } from 'react';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Avatar from '../components/ui/Avatar';
import TimeAgo from '../components/TimeAgo';
import { Spinner } from '../components/ui/Skeleton';
import PetProfileCard from '../components/PetProfileCard';
import { blockUser, getMyBlocks, getUserProfile, unblockUser } from '../api/social';
import { getPetsByUser } from '../api/pets';
import { generateMyInvites, getMyInvites } from '../api/invites';
import { resendVerification } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import ErrorState from '../components/ui/ErrorState';
import { isNotFound } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { shareLink } from '../utils/shareLink';
import { useSubscription } from '../utils/useSubscription';

export default function UserProfilePage() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const subscription = useSubscription();

  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['user-profile', id],
    queryFn: () => getUserProfile(id!),
    enabled: !!id,
  });

  const { data: pets = [], isLoading: dogsLoading } = useQuery({
    queryKey: ['user-pets', id],
    queryFn: () => getPetsByUser(id!),
    enabled: !!id,
  });

  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: (data) => {
      // Only surface the token in a dev build, never in production.
      if (import.meta.env.DEV && data.debug_token) {
        setDebugToken(data.debug_token);
        toast.success('Verification email sent (dev token below)');
      } else {
        toast.success('Verification email sent');
      }
    },
    onError: () => toast.error('Could not send verification email'),
  });

  useDocumentTitle(profile ? `${profile.display_name} · Fetchpawz` : null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError && !isNotFound(error)) {
    return <ErrorState message="Couldn't load this profile." onRetry={() => refetch()} />;
  }
  if (!profile) return <div className="p-4 text-gray-500 dark:text-gray-400">User not found</div>;

  const isMe = currentUser?.id === profile.id;

  const handleShare = () => {
    const url = `${window.location.origin}/app/users/${profile.id}`;
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
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
          aria-label="Share profile"
        >
          <Share2 size={16} aria-hidden />
          Share
        </button>
      </div>

      {/* Header */}
      <section className="flex flex-col items-center text-center px-6 pt-2 pb-6">
        <div className="rounded-full p-1 bg-gradient-to-br from-brand-300 via-brand-400 to-brand-600 shadow-soft">
          <div className="rounded-full bg-white dark:bg-gray-900 p-1">
            <Avatar name={profile.display_name} size="2xl" />
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{profile.display_name}</h1>
        {profile.location_rough && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{profile.location_rough}</p>
        )}
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Joined <TimeAgo value={profile.created_at} />
        </p>
      </section>

      {/* Stats strip */}
      <section className="mx-4 mb-5 grid grid-cols-2 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 divide-x divide-gray-100 dark:divide-gray-800 overflow-hidden">
        <div className="py-3 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{profile.pet_count}</p>
          <p className="text-2xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">
            {profile.pet_count === 1 ? 'Pet' : 'Pets'}
          </p>
        </div>
        <div className="py-3 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{profile.follower_count}</p>
          <p className="text-2xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">
            {profile.follower_count === 1 ? 'Follower' : 'Followers'}
          </p>
        </div>
      </section>

      {/* Subscription card (self only) */}
      {isMe && (
        <section className="mx-4 mb-4 rounded-2xl border border-brand-200/60 dark:border-brand-500/30 bg-gradient-to-br from-brand-50 to-white dark:from-brand-500/10 dark:to-gray-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {subscription.isSubscriber ? '🐾 Pack+ active' : 'Upgrade to Pack+'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                {subscription.isSubscriber
                  ? 'Ad-free swipes · unlimited rewinds · no daily limit.'
                  : 'Rewind swipes, ditch ads, and skip the daily limit.'}
              </p>
            </div>
            <Link
              to="/app/billing"
              className={`flex-shrink-0 inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                subscription.isSubscriber
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                  : 'bg-brand-500 text-white hover:bg-brand-600'
              }`}
            >
              {subscription.isSubscriber ? 'Manage' : 'Upgrade'}
            </Link>
          </div>
        </section>
      )}

      {/* Verify banner (self only) */}
      {isMe && currentUser && !currentUser.is_verified && (
        <section className="mx-4 mb-4 p-3 bg-warning-50 border border-warning-200 dark:bg-warning-500/10 dark:border-warning-500/30 rounded-xl text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-warning-800 dark:text-warning-200">Email not verified</p>
              <p className="text-xs text-warning-700 dark:text-warning-300 mt-0.5 break-words">
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
            <div className="mt-2 p-2 bg-white dark:bg-gray-900 border border-warning-200 dark:border-warning-500/30 rounded-lg">
              <p className="text-2xs text-warning-700 dark:text-warning-300 mb-1">
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
          <MenuLink to="/app/profile/edit" label="Edit profile" icon={<Pencil size={18} />} />
          <MenuLink to="/app/following" label="Pets I follow" icon={<PawPrint size={18} />} />
          <MenuLink to="/app/liked" label="Pets you liked" icon={<Heart size={18} />} />
          <MenuLink to="/app/transfers" label="Pet transfers" icon={<ArrowLeftRight size={18} />} />
          <MenuLink to="/app/donations" label="My donations" icon={<HeartHandshake size={18} />} />
          <MenuLink to="/app/notifications" label="Notifications" icon={<Bell size={18} />} />
        </section>
      )}

      {/* Invite friends (self only) */}
      {isMe && <InviteSection />}

      {/* Block control (someone else's profile) */}
      {!isMe && currentUser && <BlockControl userId={profile.id} displayName={profile.display_name} />}

      {/* Pets grid */}
      <section className="mx-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-bold tracking-tight">
            {isMe ? 'My pets' : `${profile.display_name.split(' ')[0]}'s pets`}
          </h2>
          {isMe && (
            <Link
              to="/app/pets/new"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              + Add pet
            </Link>
          )}
        </div>

        {dogsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : pets.length === 0 ? (
          <EmptyState
            illustration="sleeping"
            title={isMe ? 'No pets yet' : "Hasn't added any pets yet"}
            action={
              isMe ? (
                <Link
                  to="/app/pets/new"
                  className="inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Add your first pet →
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {pets.map((pet) => (
              <PetProfileCard key={pet.id} pet={pet} showEdit={isMe} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MenuLink({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm shadow-soft-sm hover:border-gray-200 dark:border-gray-700 hover:shadow-soft transition-all duration-150"
    >
      <span className="leading-none text-brand-500" aria-hidden>{icon}</span>
      <span className="flex-1 font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <ChevronRight size={18} aria-hidden className="text-gray-300 dark:text-gray-600" />
    </Link>
  );
}

function InviteSection() {
  const queryClient = useQueryClient();
  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['my-invites'],
    queryFn: getMyInvites,
  });
  const generateMutation = useMutation({
    mutationFn: generateMyInvites,
    onSuccess: () => {
      toast.success('Invite codes ready');
      queryClient.invalidateQueries({ queryKey: ['my-invites'] });
    },
    onError: () => toast.error("Couldn't generate invites right now"),
  });

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Code copied');
    } catch {
      toast.error("Couldn't copy — long-press to copy it manually");
    }
  };

  if (isLoading) return null;

  return (
    <Card as="section" className="mx-4 mb-6">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
        <Ticket size={16} aria-hidden className="text-brand-500" /> Invite friends
      </p>
      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
        Fetch is invite-only for now. Your codes let a friend in.
      </p>
      {invites.length === 0 ? (
        <Button
          size="sm"
          className="mt-3"
          loading={generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
        >
          Get my invite codes
        </Button>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {invites.map((inv) => (
            <li key={inv.id} className="flex items-center gap-2">
              <code className={`flex-1 text-sm font-mono px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 ${inv.is_used ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>
                {inv.code}
              </code>
              {inv.is_used ? (
                <span className="text-2xs font-medium text-success-600 dark:text-success-400">Used 🎉</span>
              ) : (
                <button
                  onClick={() => copy(inv.code)}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Copy
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BlockControl({ userId, displayName }: { userId: string; displayName: string }) {
  const queryClient = useQueryClient();
  const { data: blocks = [] } = useQuery({
    queryKey: ['my-blocks'],
    queryFn: getMyBlocks,
  });
  const isBlocked = blocks.some((b) => b.user_id === userId);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['my-blocks'] });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };
  const blockMutation = useMutation({
    mutationFn: () => blockUser(userId),
    onSuccess: () => { toast.success(`${displayName} blocked`); invalidate(); },
    onError: () => toast.error("Couldn't block right now"),
  });
  const unblockMutation = useMutation({
    mutationFn: () => unblockUser(userId),
    onSuccess: () => { toast.success(`${displayName} unblocked`); invalidate(); },
    onError: () => toast.error("Couldn't unblock right now"),
  });

  return (
    <section className="mx-4 mb-6 text-center">
      {isBlocked ? (
        <button
          onClick={() => unblockMutation.mutate()}
          className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
          You've blocked {displayName} · Unblock
        </button>
      ) : (
        <button
          onClick={() => {
            if (confirm(`Block ${displayName}? Neither of you will see the other's pets, comments, or messages.`)) {
              blockMutation.mutate();
            }
          }}
          className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-danger-500 dark:hover:text-danger-400 transition-colors"
        >
          Block {displayName}
        </button>
      )}
    </section>
  );
}
