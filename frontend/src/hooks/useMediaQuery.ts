import { useMemo, useSyncExternalStore } from 'react';

/**
 * The app's three layouts, as media queries. They match Tailwind's `sm` and
 * `lg` screens, so a component that branches in JS agrees with the classes
 * around it:
 *
 *   phone    < 640px   bottom tab bar, the 420px column
 *   tablet   640–1023  icon rail on the left, wider pages
 *   desktop  ≥ 1024    labelled sidebar, multi-column pages
 */
export const TABLET_UP = '(min-width: 640px)';
export const DESKTOP_UP = '(min-width: 1024px)';

function subscribe(query: string) {
  return (onChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => {};
    }
    const mq = window.matchMedia(query);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  };
}

function snapshot(query: string) {
  return () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches;
}

/**
 * True while `query` matches. Prefer Tailwind's responsive classes; reach for
 * this only when the *behaviour* changes with the layout (a bottom sheet that
 * becomes a dialog, a drag gesture that only makes sense on a phone). jsdom has
 * no matchMedia, so tests get the phone layout.
 */
export function useMediaQuery(query: string): boolean {
  // Stable per query: a fresh subscribe function on every render would make
  // React tear down and re-add the listener each time.
  const sub = useMemo(() => subscribe(query), [query]);
  const get = useMemo(() => snapshot(query), [query]);
  return useSyncExternalStore(sub, get, () => false);
}
