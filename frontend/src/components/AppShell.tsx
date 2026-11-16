import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import NavBar, { VerifyBanner } from './NavBar';
import TabBar from './nav/TabBar';
import SideNav from './nav/SideNav';
import ExploreSheet from './ExploreSheet';
import FeedbackWidget from './FeedbackWidget';
import { useAuth } from '../store/AuthContext';
import { PAGE_WIDTH, isFixedViewport as fixedViewport, pageWidthFor } from './appLayout';

/**
 * Shell for the authenticated web *app* (`/app/*`). Three layouts, one tree:
 *
 * - **Phone (< 640px)** — the original product: a centred 420px column, top
 *   bar, bottom tab bar. Nothing here changes below `sm`.
 * - **Tablet (sm, 640–1023px)** — the tab bar becomes an icon rail on the
 *   left; pages get a wider column.
 * - **Desktop (lg, ≥ 1024px)** — the rail becomes a labelled sidebar that
 *   also lists Explore; wide pages lay out in columns.
 *
 * The marketing website (see `marketing/MarketingLayout`) is a separate,
 * web-first experience so the two intents don't bleed into each other.
 */

export default function AppShell() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [exploreOpen, setExploreOpen] = useState(false);
  // The swipe deck owns its own drag physics — a translating page entrance
  // would fight the card gestures, so that route gets opacity only.
  const isSwipe = location.pathname.startsWith('/app/swipe');
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const isFixedViewport = fixedViewport(path);

  // Close the Explore sheet on navigation so it doesn't linger when the user
  // picks an item or hits back.
  useEffect(() => {
    setExploreOpen(false);
  }, [location.pathname]);

  const toggleExplore = () => setExploreOpen((v) => !v);
  // The centred page container from `sm` up; the verify banner shares it so
  // the two line up.
  const container = `mx-auto w-full sm:px-4 lg:px-6 ${PAGE_WIDTH[pageWidthFor(path)]}`;

  return (
    <div
      className={`mx-auto max-w-app bg-biscuit dark:bg-night min-[421px]:border-x min-[421px]:border-navy/10 dark:min-[421px]:border-white/10 sm:max-w-none sm:border-x-0 ${
        isFixedViewport
          ? // h-dvh tracks the real visible viewport (iOS URL bar). The
            // bottom padding reserves space for the fixed tab bar using the
            // height TabBar measures into --tab-bar-h (content + safe-area
            // inset), so the pane bottoms sit exactly on the tab bar's top
            // edge. Inside a bounded h-dvh this padding can't create
            // document overflow the way pb-20 + min-h-screen did. From `sm`
            // the tab bar is hidden and the var measures 0.
            'h-[calc(100dvh-var(--site-banner-h,0px))] flex flex-col overflow-hidden pb-[var(--tab-bar-h,80px)]'
          : 'min-h-screen pb-[var(--tab-bar-h,80px)] sm:pb-0'
      }`}
    >
      {/* Keyboard users would otherwise tab through the top bar and, on a
          desktop, the whole sidebar before reaching the page, on every page. */}
      <a
        href="#main"
        // Focus the page directly rather than following the hash, which
        // would leave #main in the address bar for the next copied link.
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-full focus:border-2 focus:border-navy focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-extrabold focus:text-navy"
      >
        Skip to content
      </a>
      <NavBar />
      <div className={isFixedViewport ? 'flex flex-1 min-h-0' : 'sm:flex'}>
        {isAuthenticated && (
          <SideNav exploreOpen={exploreOpen} onToggleExplore={toggleExplore} />
        )}
        <main
          id="main"
          tabIndex={-1}
          className={`min-w-0 flex-1 outline-none ${isFixedViewport ? 'flex min-h-0 flex-col' : 'sm:pb-12'}`}
        >
          <VerifyBanner className={isFixedViewport ? 'sm:px-4 sm:pb-3' : container} />
          {/*
            Keyed, opacity-only fade instead of AnimatePresence.

            AnimatePresence kept the *outgoing* route mounted (as an in-flow
            block) while the incoming route mounted below it during the exit
            animation, so the new page was pushed down and dead space opened at
            the top until the exit finished. On slower devices / rapid
            navigation the outgoing node could linger, so the gap accumulated
            across clicks and only a full refresh cleared it. (A bare <Outlet/>
            made it worse: the outgoing copy re-rendered the *current* route,
            briefly duplicating the page height.)

            A keyed CSS fade swaps atomically — the old node unmounts in the
            same commit the new one mounts, with no exit phase — so two pages
            never share the layout. This is the same approach the marketing
            pages use.
          */}
          <div
            key={location.pathname}
            className={`${isSwipe ? 'animate-fade-in' : 'animate-fade-in-up'} ${
              // Fixed-viewport pages fill the whole pane beside the rail and
              // get a definite flex height (their roots use flex-1 min-h-0
              // instead of viewport math). Everything else is a centred
              // column whose width the page's kind decides.
              isFixedViewport
                ? 'flex-1 min-h-0 flex flex-col'
                : `${container} sm:pt-3 lg:pt-5`
            }`}
          >
            {/*
              The shell needs its own Suspense boundary, and it is load-bearing.

              Most routes under /app are React.lazy. The only boundary used to
              be the one in App.tsx, which sits *above* AuthGuard and AppShell,
              so a route whose chunk was not cached suspended the entire shell:
              NavBar, the tab bar, and anything they were rendering all froze in
              their last committed state until the chunk arrived.

              That is what made the Explore sheet look stuck. Tapping Community
              closed the sheet and navigated in one click, but PostsPage is
              lazy, so the commit that would have run the sheet's exit
              animation never landed. The sheet stayed painted at y=0 while
              React reported it closed, and tapping the backdrop did nothing
              because every retry suspended again on the same pending chunk.
              Verified by A/B in a real browser: stuck with this boundary
              removed, clean with it in place.

              Keeping the boundary here means only the page area waits.
            */}
            <Suspense fallback={<div className="min-h-[50vh]" aria-busy="true" aria-live="polite" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      {isAuthenticated && (
        <>
          <TabBar exploreOpen={exploreOpen} onToggleExplore={toggleExplore} />
          <ExploreSheet
            open={exploreOpen}
            onClose={() => setExploreOpen(false)}
            species={user?.species_preference}
          />
        </>
      )}
      {location.pathname === '/app/home' && <FeedbackWidget />}
    </div>
  );
}
