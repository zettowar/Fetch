import { Outlet, useLocation } from 'react-router-dom';
import NavBar from './NavBar';
import FeedbackWidget from './FeedbackWidget';

/**
 * Shell for the authenticated web *app* (`/app/*`).
 *
 * Deliberately mobile-portrait: a centered 420px column with the top bar and
 * bottom tab navigation. This is the product surface — the marketing website
 * (see `marketing/MarketingLayout`) is a separate, web-first experience so the
 * two intents don't bleed into each other.
 */
export default function AppShell() {
  const location = useLocation();
  // The swipe deck owns its own drag physics — a translating page entrance
  // would fight the card gestures, so that route gets opacity only.
  const isSwipe = location.pathname.startsWith('/app/swipe');

  return (
    <div className="mx-auto max-w-app min-h-screen bg-white dark:bg-gray-900 pb-20 shadow-soft-lg">
      <NavBar />
      {/*
        Keyed, opacity-only fade instead of AnimatePresence.

        AnimatePresence kept the *outgoing* route mounted (as an in-flow block)
        while the incoming route mounted below it during the exit animation, so
        the new page was pushed down and dead space opened at the top until the
        exit finished. On slower devices / rapid navigation the outgoing node
        could linger, so the gap accumulated across clicks and only a full
        refresh cleared it. (A bare <Outlet/> made it worse: the outgoing copy
        re-rendered the *current* route, briefly duplicating the page height.)

        A keyed CSS fade swaps atomically — the old node unmounts in the same
        commit the new one mounts, with no exit phase — so two pages never share
        the layout. This is the same approach the marketing pages use.
      */}
      <div key={location.pathname} className={isSwipe ? 'animate-fade-in' : 'animate-fade-in-up'}>
        <Outlet />
      </div>
      {location.pathname === '/app/home' && <FeedbackWidget />}
    </div>
  );
}
