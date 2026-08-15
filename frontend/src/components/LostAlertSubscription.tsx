import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { BellRing } from 'lucide-react';
import {
  createSubscription,
  getMySubscription,
  updateSubscription,
} from '../api/lost';
import { apiErrorMessage } from '../utils/apiError';
import Button from './ui/Button';

interface Props {
  /** Map centre — what the user is currently looking at. */
  center: [number, number];
}

const RADII = [5, 10, 25, 50];

/**
 * Turn proximity alerts on for the area the user is looking at.
 *
 * `createSubscription`/`updateSubscription` existed in the API client with no
 * caller anywhere, so no subscription could ever be created — which meant the
 * lost_alerts Celery job had permanently zero subscribers and the emails it
 * sends had never reached a single person.
 */
export default function LostAlertSubscription({ center }: Props) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: sub, isLoading } = useQuery({
    queryKey: ['lost-subscription'],
    queryFn: getMySubscription,
    retry: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['lost-subscription'] });

  const subscribe = useMutation({
    mutationFn: (radius_km: number) =>
      createSubscription({
        home_lat: center[1],
        home_lng: center[0],
        radius_km,
      }),
    onSuccess: () => {
      toast.success("Alerts on — we'll email you when a pet goes missing nearby");
      setExpanded(false);
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't turn alerts on")),
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => updateSubscription({ enabled }),
    onSuccess: (_d, enabled) => {
      toast.success(enabled ? 'Alerts back on' : 'Alerts paused');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't update alerts")),
  });

  if (isLoading) return null;

  // Already subscribed → a compact on/off row.
  if (sub) {
    return (
      <div className="flex items-center gap-2.5 border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <BellRing
          size={15}
          aria-hidden
          className={sub.enabled ? 'text-brand-500' : 'text-gray-400'}
        />
        <p className="flex-1 min-w-0 text-xs text-gray-600 dark:text-gray-300">
          {sub.enabled
            ? `Alerting you about pets lost within ${sub.radius_km} km`
            : 'Lost-pet alerts are paused'}
        </p>
        <button
          type="button"
          onClick={() => toggle.mutate(!sub.enabled)}
          disabled={toggle.isPending}
          className="flex-shrink-0 text-xs font-semibold text-brand-500 hover:underline disabled:opacity-50"
        >
          {sub.enabled ? 'Pause' : 'Resume'}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-2.5 text-left"
        >
          <BellRing size={15} className="text-brand-500" aria-hidden />
          <span className="flex-1 text-xs text-gray-600 dark:text-gray-300">
            Get emailed when a pet goes missing near here
          </span>
          <span className="text-xs font-semibold text-brand-500">Set up</span>
        </button>
      ) : (
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Alert me about pets lost within&hellip;
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RADII.map((r) => (
              <Button
                key={r}
                size="sm"
                variant="secondary"
                loading={subscribe.isPending && subscribe.variables === r}
                disabled={subscribe.isPending}
                onClick={() => subscribe.mutate(r)}
              >
                {r} km
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(false)}
              disabled={subscribe.isPending}
            >
              Cancel
            </Button>
          </div>
          <p className="mt-2 text-2xs text-gray-400 dark:text-gray-500">
            Centred on the area you&rsquo;re viewing. You can pause or change it
            any time.
          </p>
        </div>
      )}
    </div>
  );
}
