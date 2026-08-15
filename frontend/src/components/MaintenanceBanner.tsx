import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, X } from 'lucide-react';
import { getSiteBanner } from '../api/publicSite';

const DISMISSED_KEY = 'fetch.banner.dismissed';

/**
 * The admin-set site-wide strip.
 *
 * Admins could set this and the API served it, but nothing rendered it — so
 * the one lever for telling everyone "we're doing maintenance at 9pm" did
 * nothing at all.
 *
 * Dismissal is keyed on the banner text, so changing the message re-shows it to
 * everyone who dismissed the previous one.
 */
export default function MaintenanceBanner() {
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY);
    } catch {
      return null;
    }
  });

  const { data } = useQuery({
    queryKey: ['site-banner'],
    queryFn: getSiteBanner,
    // Operational message: worth re-checking periodically, cheap to fetch.
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  const text = data?.banner?.trim();
  if (!text || dismissed === text) return null;

  return (
    <div
      role="status"
      className="relative z-30 flex items-start gap-2.5 bg-warning-100 px-4 py-2.5 text-sm text-warning-900 dark:bg-warning-500/15 dark:text-warning-100"
    >
      <Megaphone size={16} className="mt-0.5 flex-shrink-0" aria-hidden />
      <p className="flex-1 min-w-0">{text}</p>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          try {
            localStorage.setItem(DISMISSED_KEY, text);
          } catch {
            /* private mode — dismiss for this page view only */
          }
          setDismissed(text);
        }}
        className="-mr-1 -mt-0.5 flex-shrink-0 rounded-lg p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
