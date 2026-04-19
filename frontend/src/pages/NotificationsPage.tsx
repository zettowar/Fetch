import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getPreferences, updatePreferences, type NotificationPrefs } from '../api/notifications';
import BackButton from '../components/ui/BackButton';
import Skeleton from '../components/ui/Skeleton';

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
      <div className="p-4">
        <Skeleton className="h-6 w-40 mb-6" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full mb-2 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-4 pb-8">
      <BackButton fallback="/home" />
      <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
        <span aria-hidden>🔔</span> Notifications
      </h1>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">Choose what you want to hear about.</p>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 mb-5">
        <ToggleRow
          label="Lost dog alerts"
          description="Notifications when dogs go missing near you"
          checked={prefs.lost_dog_alerts}
          onChange={(val) => update({ lost_dog_alerts: val })}
        />
        <ToggleRow
          label="Weekly winner"
          description="Announce the top dog each week"
          checked={prefs.weekly_winner}
          onChange={(val) => update({ weekly_winner: val })}
        />
        <ToggleRow
          label="Comments on your dogs"
          description="When someone leaves a comment on your dog's profile"
          checked={prefs.comments_on_dogs}
          onChange={(val) => update({ comments_on_dogs: val })}
        />
        <ToggleRow
          label="New followers"
          description="When someone starts following one of your dogs"
          checked={prefs.new_followers}
          onChange={(val) => update({ new_followers: val })}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-3">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-1.5">
          <span aria-hidden>📧</span> Digest emails
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
      </div>
    </div>
  );
}
