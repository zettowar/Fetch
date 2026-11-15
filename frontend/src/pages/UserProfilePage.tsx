import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronRight } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import BrandIcon, { type BrandIconName } from '../components/brand/BrandIcon';
import TimeAgo from '../components/TimeAgo';
import { Spinner } from '../components/ui/Skeleton';
import PetProfileCard from '../components/PetProfileCard';
import { blockUser, getMyBlocks, getUserProfile, unblockUser } from '../api/social';
import { getPetsByUser } from '../api/pets';
import { generateMyInvites, getMyInvites } from '../api/invites';
import { resendVerification } from '../api/auth';
import { getUnreadTicketCount } from '../api/support';
import { useAuth } from '../store/AuthContext';
import ErrorState from '../components/ui/ErrorState';
import { ReportButton } from '../components/ReportDialog';
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
  if (!profile) return <div className="p-4 text-gray-600 dark:text-gray-300">User not found</div>;

  const isMe = currentUser?.id === profile.id;

  const handleShare = () => {
    const url = `${window.location.origin}/app/users/${profile.id}`;
    shareLink(url, `${profile.display_name} on Fetchpawz`);
  };

  return (
    <div className="pb-6">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3">
        <BackButton />
        <button
          type="button"
          onClick={handleShare}
          className="btn btn-ghost btn-sm"
          aria-label="Share profile"
        >
          <BrandIcon name="share" size={18} />
          Share
        </button>
      </div>

      {/* Header */}
      <section className="flex flex-col items-center text-center px-6 pt-2 pb-6">
        {/* Flat ring, no gradient: the avatar's own navy line does the work. */}
        <div className="rounded-full bg-white p-1.5 border border-gray-200 dark:bg-night-surface dark:border-white/10">
          <Avatar name={profile.display_name} size="2xl" />
        </div>
        <h1 className="mt-4 text-[28px] leading-tight text-navy dark:text-biscuit text-balance">{profile.display_name}</h1>
        {profile.location_rough && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{profile.location_rough}</p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Joined <TimeAgo value={profile.created_at} />
        </p>
      </section>

      {/* Stats strip */}
      <section className="surface mx-4 mb-5 grid grid-cols-2 divide-x divide-gray-200 dark:divide-white/10 overflow-hidden">
        <div className="py-3 text-center">
          <p className="font-display text-[28px] leading-none text-navy dark:text-biscuit tabular-nums">{profile.pet_count}</p>
          <p className="eyebrow mt-1.5">
            {profile.pet_count === 1 ? 'Pet' : 'Pets'}
          </p>
        </div>
        <div className="py-3 text-center">
          <p className="font-display text-[28px] leading-none text-navy dark:text-biscuit tabular-nums">{profile.follower_count}</p>
          <p className="eyebrow mt-1.5">
            {profile.follower_count === 1 ? 'Follower' : 'Followers'}
          </p>
        </div>
      </section>

      {/* Subscription card (self only) */}
      {isMe && (
        // Premium surfaces are Leash Navy (no gradient, never gold — a
        // subscription is bought, not earned).
        <section className="mx-4 mb-4 rounded-2xl bg-navy p-4 text-biscuit dark:bg-night-raised dark:border dark:border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-base font-extrabold tracking-tight">
                {subscription.isSubscriber && <BrandIcon name="check" size={18} />}
                {subscription.isSubscriber ? 'Pack+ active' : 'Upgrade to Pack+'}
              </p>
              <p className="text-xs text-biscuit/80 mt-0.5">
                {subscription.isSubscriber
                  ? 'Ad-free swipes · unlimited rewinds · no daily limit.'
                  : 'Rewind swipes, ditch ads, and skip the daily limit.'}
              </p>
            </div>
            <Link
              to="/app/billing"
              className={`btn btn-sm flex-shrink-0 ${
                subscription.isSubscriber ? 'btn-secondary' : 'btn-primary'
              }`}
            >
              {subscription.isSubscriber ? 'Manage' : 'Upgrade'}
            </Link>
          </div>
        </section>
      )}

      {/* Verify banner (self only) */}
      {isMe && currentUser && !currentUser.is_verified && (
        // Pending, not an error: the warning tint with navy ink.
        <section className="mx-4 mb-4 p-3.5 bg-warning-50 border border-warning-300 dark:bg-warning-500/10 dark:border-warning-500/30 rounded-2xl text-sm text-navy dark:text-biscuit">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-extrabold">Email not verified</p>
              <p className="text-xs text-gray-700 dark:text-gray-200 mt-0.5 break-words">
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
            <div className="mt-2 p-2 bg-white dark:bg-night-surface border border-warning-300 dark:border-warning-500/30 rounded-lg">
              <p className="text-2xs text-gray-600 dark:text-gray-300 mb-1">
                Dev mode: no SMTP configured. Use this link to verify:
              </p>
              <Link
                to={`/verify-email/${debugToken}`}
                className="text-xs font-mono break-all font-bold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit"
              >
                {window.location.origin}/verify-email/{debugToken}
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Account menu (self only) */}
      {isMe && (
        // One flat panel of rows, not a stack of floating cards.
        <section className="surface mx-4 mb-6 flex flex-col divide-y divide-gray-200 dark:divide-white/10 overflow-hidden">
          <MenuLink to="/app/profile/edit" label="Edit profile" icon="user" />
          <MenuLink to="/app/following" label="Pets I follow" icon="follow" />
          <MenuLink to="/app/liked" label="Pets you liked" icon="like" />
          <MenuLink to="/app/transfers" label="Pet transfers" icon="share" />
          <MenuLink to="/app/donations" label="My donations" icon="donate" />
          <MenuLink to="/app/notifications" label="Notifications" icon="bell" />
          {/* The only route to two-factor setup and "Close your account". */}
          <MenuLink to="/app/security" label="Security" icon="shield" />
          <SupportMenuLink />
        </section>
      )}

      {/* Invite friends (self only) */}
      {isMe && <InviteSection />}

      {/* Block control (someone else's profile) */}
      {!isMe && currentUser && (
        <>
          <BlockControl userId={profile.id} displayName={profile.display_name} />
          <div className="mx-4 mt-2 flex justify-end">
            <ReportButton
              targetType="user"
              targetId={profile.id}
              targetLabel={profile.display_name}
            />
          </div>
        </>
      )}

      {/* Pets grid */}
      <section className="mx-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit">
            {isMe ? 'My pets' : `${profile.display_name.split(' ')[0]}'s pets`}
          </h2>
          {isMe && (
            <Link to="/app/pets/new" className="btn btn-ghost btn-sm">
              <BrandIcon name="plus" size={18} />
              Add pet
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
                <Link to="/app/pets/new" className="btn btn-secondary btn-sm">
                  Add your first pet
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

function MenuLink({ to, label, icon, badge }: { to: string; label: string; icon: BrandIconName; badge?: number }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3.5 py-3 text-sm text-navy transition-colors hover:bg-navy/5 dark:text-biscuit dark:hover:bg-white/5"
    >
      <BrandIcon name={icon} size={22} />
      <span className="flex-1 font-bold">{label}</span>
      {badge ? (
        <span
          className="min-w-[22px] rounded-full border-[1.5px] border-navy bg-brand-500 px-1.5 py-0.5 text-center text-2xs font-extrabold leading-none text-navy"
          aria-label={`${badge} unread`}
        >
          {badge}
        </span>
      ) : null}
      <ChevronRight size={18} aria-hidden className="text-navy/40 dark:text-white/30" />
    </Link>
  );
}

/** The support entry, badged when support has replied and the reporter has not
 *  read it yet. Without this the only way to learn an answer arrived is the
 *  notification inbox or an email that may never have been delivered. */
function SupportMenuLink() {
  const { data: unread = 0 } = useQuery({
    queryKey: ['ticket-unread'],
    queryFn: getUnreadTicketCount,
  });
  return (
    <MenuLink
      to="/app/support"
      label="Help & support"
      icon="help"
      badge={unread}
    />
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
      <p className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit flex items-center gap-2">
        <BrandIcon name="mail" size={20} /> Invite friends
      </p>
      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
        Fetchpawz is invite-only for now. Your codes let a friend in.
      </p>
      {invites.length === 0 ? (
        <Button
          size="sm"
          variant="secondary"
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
              <code className={`flex-1 text-sm font-mono px-2.5 py-1.5 rounded-lg border border-gray-200 bg-biscuit dark:border-white/10 dark:bg-night-raised ${inv.is_used ? 'line-through text-gray-500 dark:text-gray-400' : 'text-navy dark:text-biscuit'}`}>
                {inv.code}
              </code>
              {inv.is_used ? (
                <Badge variant="success">Used</Badge>
              ) : (
                <button
                  onClick={() => copy(inv.code)}
                  className="btn btn-secondary btn-sm"
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
    // The profile's own pet list is hidden across a block — refresh it too.
    queryClient.invalidateQueries({ queryKey: ['user-pets', userId] });
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
          className="text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-navy dark:hover:text-biscuit transition-colors"
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
          className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-danger-600 dark:hover:text-danger-300 transition-colors"
        >
          Block {displayName}
        </button>
      )}
    </section>
  );
}
