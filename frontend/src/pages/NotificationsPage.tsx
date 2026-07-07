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
import {
  ArrowLeftRight,
  Bell,
  Camera,
  Eye,
  HousePlus,
  Mail,
  MessageCircle,
  PawPrint,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Skeleton, { ListSkeleton } from '../components/ui/Skeleton';
import TimeAgo from '../components/TimeAgo';

const TYPE_ICONS: Record<string, LucideIcon> = {
  follow: PawPrint,
  comment: MessageCircle,
  sighting: Eye,
  transfer_received: ArrowLeftRight,
  transfer_resolved: ArrowLeftRight,
  inquiry_received: HousePlus,
  inquiry_status: HousePlus,
  weekly_winner: Trophy,
  photo_moderated: Camera,
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
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
          >
            Mark all read
          </button>
        </div>
      )}
      <Card as="ul" padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.map((n) => {
          const Icon = TYPE_ICONS[n.type] ?? Bell;
          return (
          <li key={n.id}>
            <button
              onClick={() => open(n)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${
                n.read_at ? 'opacity-70' : ''
              }`}
            >
              <span
                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-500"
                aria-hidden
              >
                <Icon size={16} />
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm ${n.read_at ? 'font-normal' : 'font-semibold'} text-gray-900 dark:text-gray-100`}>
                  {n.title}
                </span>
                {n.body && (
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {n.body}
                  </span>
                )}
                <span className="block text-2xs text-gray-400 dark:text-gray-500 mt-0.5">
                  <TimeAgo value={n.created_at} />
                </span>
              </span>
              {!n.read_at && (
                <span aria-hidden className="mt-2 w-2 h-2 rounded-full bg-brand-500 shrink-0" />
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
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="mr-4">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 bg-white dark:bg-gray-900 rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<'inbox' | 'settings'>('inbox');
  const { data: unread = 0 } = useQuery({
    queryKey: ['inbox-unread'],
    queryFn: getUnreadCount,
  });

  return (
    <div className="p-4 pb-8">
      <BackButton fallback="/app/home" />
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Bell size={20} aria-hidden className="text-brand-500" /> Notifications
      </h1>

      <div className="flex gap-1 mb-4">
        {(['inbox', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t}
            {t === 'inbox' && unread > 0 && (
              <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-2xs font-bold ${
                tab === 'inbox' ? 'bg-white text-brand-600' : 'bg-brand-500 text-white'
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
      toast.error('Failed to save preference');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-prefs'] });
    },
  });

  if (isLoading || !prefs) {
    return (
      <div>
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full mb-2 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Choose what you want to hear about.</p>

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

      <Card padding="none" className="px-4 py-3">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-1.5">
          <Mail size={16} aria-hidden className="text-brand-500" /> Digest emails
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Get a summary instead of individual emails</p>
        <div className="flex gap-2">
          {(['off', 'daily', 'weekly'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => update({ digest_mode: mode })}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                prefs.digest_mode === mode
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
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
