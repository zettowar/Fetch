import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getInbox,
  getPreferences,
  getUnreadCount,
  markAllRead,
  markRead,
  updatePreferences,
  type InboxNotification,
  type NotificationPrefs,
} from '../api/notifications';
import BrandIcon, { type BrandIconName } from '../components/brand/BrandIcon';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Skeleton, { ListSkeleton } from '../components/ui/Skeleton';
import TimeAgo from '../components/TimeAgo';
import NotificationBody from '../components/NotificationBody';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// One drawn icon per kind, always in the same white tile: the icon's own
// bean carries the feature colour (gold for a crown, pink for an adoption
// inquiry), so the rows themselves are never colour-coded.
const TYPE_ICONS: Record<string, BrandIconName> = {
  follow: 'follow',
  comment: 'comment',
  sighting: 'eye',
  lost_reunited: 'rescue',
  transfer_received: 'share',
  transfer_resolved: 'share',
  inquiry_received: 'rescue',
  inquiry_status: 'rescue',
  weekly_winner: 'crown',
  photo_moderated: 'camera',
};

function InboxTab() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => getInbox({ limit: 50 }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inbox'] });
    queryClient.invalidateQueries({ queryKey: ['inbox-unread'] });
  };
  const readMutation = useMutation({ mutationFn: markRead, onSettled: invalidate });
  const readAllMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => toast.success('All caught up'),
    onSettled: invalidate,
  });

  const open = (n: InboxNotification) => {
    if (!n.read_at) readMutation.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  if (isLoading) {
    return <ListSkeleton rows={5} />;
  }
  if (isError) {
    return <ErrorState message="Couldn't load your notifications." onRetry={() => refetch()} />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        illustration="sleeping"
        title="Nothing yet"
        body="Follows, comments, and big news land here."
      />
    );
  }

  const hasUnread = items.some((n) => !n.read_at);
  return (
    <div>
      {hasUnread && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => readAllMutation.mutate()}
            className="btn btn-ghost btn-sm"
          >
            Mark all read
          </button>
        </div>
      )}
      <Card as="ul" padding="none" className="divide-y divide-gray-200 dark:divide-white/10">
        {items.map((n) => {
          const icon = TYPE_ICONS[n.type] ?? 'bell';
          return (
          <li key={n.id}>
            <button
              onClick={() => open(n)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-navy/5 dark:hover:bg-white/5 transition-colors"
            >
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-navy/25 bg-white text-navy dark:border-white/20 dark:bg-night-raised dark:text-biscuit"
                aria-hidden
              >
                <BrandIcon name={icon} size={22} />
              </span>
              <span className="flex-1 min-w-0 pt-0.5">
                <span
                  className={`block text-sm ${
                    n.read_at
                      ? 'font-semibold text-gray-700 dark:text-gray-200'
                      : 'font-extrabold text-navy dark:text-biscuit'
                  }`}
                >
                  {n.title}
                </span>
                {n.body && <NotificationBody type={n.type} body={n.body} />}
                <span className="block text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
                  <TimeAgo value={n.created_at} />
                </span>
              </span>
              {!n.read_at && (
                <span aria-hidden className="mt-2 h-2.5 w-2.5 rounded-full bg-brand-500 shrink-0" />
              )}
            </button>
          </li>
          );
        })}
      </Card>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-white/10 last:border-0">
      <div className="mr-4">
        <p className="text-sm font-bold text-navy dark:text-biscuit">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      {/* Toggle: Ball Orange when on, always on a navy line. */}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-12 h-7 rounded-full border-2 transition-colors ${
          checked
            ? 'border-navy bg-brand-500'
            : 'border-navy/40 bg-white dark:border-white/30 dark:bg-night-raised'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full border-2 border-navy bg-white transition-transform duration-150 ease-soft-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  useDocumentTitle('Notifications · Fetchpawz');
  const [tab, setTab] = useState<'inbox' | 'settings'>('inbox');
  const { data: unread = 0 } = useQuery({
    queryKey: ['inbox-unread'],
    queryFn: getUnreadCount,
  });

  return (
    <div className="p-4 pb-8">
      <PageHeader back backFallback="/app/home" title="Notifications" className="mb-4" />

      <div className="seg mb-4">
        {(['inbox', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 capitalize inline-flex items-center ${
              tab === t ? 'seg-on' : 'hover:bg-navy/5 dark:hover:bg-white/10'
            }`}
          >
            {t}
            {t === 'inbox' && unread > 0 && (
              <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-2xs font-extrabold ${
                tab === 'inbox'
                  ? 'bg-navy text-biscuit'
                  : 'border-[1.5px] border-navy bg-brand-500 text-navy'
              }`}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'inbox' ? <InboxTab /> : <SettingsTab />}
    </div>
  );
}

function SettingsTab() {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: getPreferences,
  });

  const { mutate: update } = useMutation({
    mutationFn: updatePreferences,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ['notification-prefs'] });
      const prev = queryClient.getQueryData<NotificationPrefs>(['notification-prefs']);
      queryClient.setQueryData(['notification-prefs'], (old: NotificationPrefs) => ({ ...old, ...patch }));
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['notification-prefs'], ctx.prev);
      toast.error("Couldn't save that setting. Try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-prefs'] });
    },
  });

  if (isLoading || !prefs) {
    return (
      <div>
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full mb-2 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Choose what you want to hear about.</p>

      <Card padding="none" className="px-4 mb-5">
        <ToggleRow
          label="Lost pet alerts"
          description="Notifications when pets go missing near you"
          checked={prefs.lost_dog_alerts}
          onChange={(val) => update({ lost_dog_alerts: val })}
        />
        <ToggleRow
          label="Weekly winner"
          description="Announce the top pet each week"
          checked={prefs.weekly_winner}
          onChange={(val) => update({ weekly_winner: val })}
        />
        <ToggleRow
          label="Comments on your pets"
          description="When someone leaves a comment on your pet's profile"
          checked={prefs.comments_on_dogs}
          onChange={(val) => update({ comments_on_dogs: val })}
        />
        <ToggleRow
          label="New followers"
          description="When someone starts following one of your pets"
          checked={prefs.new_followers}
          onChange={(val) => update({ new_followers: val })}
        />
      </Card>

      {/* Email-only consents. These are what the one-click unsubscribe links
          write, so they have to be reversible from here. */}
      <Card padding="none" className="px-4 mb-5">
        <p className="pt-3 text-base font-extrabold tracking-tight text-navy dark:text-biscuit flex items-center gap-2">
          <BrandIcon name="mail" size={20} /> Emails
        </p>
        <ToggleRow
          label="Weekly recap"
          description="How your pets did last week — likes, rank and movement"
          checked={prefs.weekly_recap}
          onChange={(val) => update({ weekly_recap: val })}
        />
        <ToggleRow
          label="Product announcements"
          description="Occasional updates from the Fetchpawz team"
          checked={prefs.announcement_emails}
          onChange={(val) => update({ announcement_emails: val })}
        />
      </Card>

      <Card padding="none" className="px-4 py-3">
        <p className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit mb-1 flex items-center gap-2">
          <BrandIcon name="mail" size={20} /> Digest emails
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Get a summary instead of individual emails</p>
        <div className="seg flex w-full">
          {(['off', 'daily', 'weekly'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => update({ digest_mode: mode })}
              className={`flex-1 ${
                prefs.digest_mode === mode ? 'seg-on' : 'hover:bg-navy/5 dark:hover:bg-white/10'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
