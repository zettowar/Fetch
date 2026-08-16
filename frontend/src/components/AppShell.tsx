import { Suspense } from 'react';
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
/**
 * Fixed-viewport screens: map/list split panes that own ALL scrolling
 * internally (map pans, list pane scrolls). For these the document itself
 * must not scroll — the old `h-[calc(100vh-56px)]` page height plus the
 * shell's `pb-20` left ~80px of body overflow (more on iOS, where 100vh is
 * the URL-bar-collapsed viewport), so vertical swipes were ambiguous between
 * body, map, and list. Exact-match paths; detail pages under them scroll
 * normally.
 */
const FIXED_VIEWPORT_PATHS = new Set([
  '/app/lost',
  '/app/parks',
  '/app/vets',
  '/app/rescues/browse',
  '/app/rescues/map',
]);

export default function AppShell() {
  const location = useLocation();
  // The swipe deck owns its own drag physics — a translating page entrance
  // would fight the card gestures, so that route gets opacity only.
  const isSwipe = location.pathname.startsWith('/app/swipe');
  const isFixedViewport = FIXED_VIEWPORT_PATHS.has(
    location.pathname.replace(/\/+$/, '') || '/',
  );

  return (
    <div
      className={`mx-auto max-w-app bg-white dark:bg-gray-900 shadow-soft-lg ${
        isFixedViewport
          ? // h-dvh tracks the real visible viewport (iOS URL bar). The
            // bottom padding reserves space for the fixed tab bar using the
            // height NavBar measures into --tab-bar-h (content + safe-area
            // inset), so the pane bottoms sit exactly on the tab bar's top
            // edge. Inside a bounded h-dvh this padding can't create
            // document overflow the way pb-20 + min-h-screen did.
            'h-dvh flex flex-col overflow-hidden pb-[var(--tab-bar-h,80px)]'
          : 'min-h-screen pb-20'
      }`}
    >
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
      <div
        key={location.pathname}
        className={`${isSwipe ? 'animate-fade-in' : 'animate-fade-in-up'} ${
          // Give fixed-viewport pages a definite flex height to fill
          // (their roots use flex-1 min-h-0 instead of viewport math).
          isFixedViewport ? 'flex-1 min-h-0 flex flex-col' : ''
        }`}
      >
        {/*
          The shell needs its own Suspense boundary, and it is load-bearing.

          Most routes under /app are React.lazy. The only boundary used to be
          the one in App.tsx, which sits *above* AuthGuard and AppShell, so a
          route whose chunk was not cached suspended the entire shell: NavBar,
          the tab bar, and anything they were rendering all froze in their
          last committed state until the chunk arrived.

          That is what made the Explore sheet look stuck. Tapping Community
          closed the sheet and navigated in one click, but PostsPage is lazy,
          so the commit that would have run the sheet's exit animation never
          landed. The sheet stayed painted at y=0 while React reported it
          closed, and tapping the backdrop did nothing because every retry
          suspended again on the same pending chunk. Verified by A/B in a real
          browser: stuck with this boundary removed, clean with it in place.

          Keeping the boundary here means only the page area waits.
        */}
        <Suspense fallback={<div className="min-h-[50vh]" aria-busy="true" aria-live="polite" />}>
          <Outlet />
        </Suspense>
      </div>
      {location.pathname === '/app/home' && <FeedbackWidget />}
    </div>
  );
}
