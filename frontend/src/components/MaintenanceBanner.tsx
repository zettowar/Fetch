import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { getSiteBanner } from '../api/publicSite';
import BrandIcon from './brand/BrandIcon';

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
      // An operational notice is information, not an achievement: a flat
      // white strip with a hairline and the bell, never Crown Gold.
      className="relative z-30 flex items-start gap-2.5 border-b border-gray-200 bg-white px-4 py-2.5 text-sm text-navy dark:border-white/10 dark:bg-night-surface dark:text-biscuit"
    >
      <BrandIcon name="bell" size={18} className="mt-px" />
      <p className="flex-1 min-w-0 font-semibold">{text}</p>
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
        className="-mr-1 -mt-0.5 flex-shrink-0 rounded-full p-1.5 text-gray-600 transition-colors hover:bg-navy/5 hover:text-navy dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-biscuit"
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
