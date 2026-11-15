import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LogOut, Sun } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { logout as apiLogout } from '../api/auth';
import { exitImpersonation, getRefreshToken, impersonationToken } from '../api/client';
import { getUnreadCount } from '../api/notifications';
import { useCart } from '../utils/useCart';
import Lockup from './brand/Lockup';
import PawMark from './ui/PawMark';
import BrandIcon, { type BrandIconName } from './brand/BrandIcon';
import ExploreSheet from './ExploreSheet';
import { usePublicFlags } from '../hooks/usePublicFlags';

// Paths that the Explore sheet routes to — used to mark the tab "active"
// when any of those destinations is showing.
const EXPLORE_PATHS = ['/app/explore', '/app/parks', '/app/vets'] as const;

type NavItem = {
  path: string;
  label: string;
  /** A drawn brand icon (Brand Book, Icons → Tab bar). */
  icon: BrandIconName;
  isSheet?: boolean;
};

const CONSUMER_NAV_ITEMS: readonly NavItem[] = [
  { path: '/app/home', label: 'Home', icon: 'home' },
  { path: '/app/swipe', label: 'Swipe', icon: 'like' },
  { path: '/app/rescues', label: 'Rescues', icon: 'rescue' },
  { path: '/app/lost', label: 'Lost', icon: 'lost' },
  { path: '__explore__', label: 'Explore', icon: 'explore', isSheet: true },
];

/**
 * The round 32px control every top-bar action shares. `shrink-0` matters: the
 * bar holds up to six of these beside the brand on a 375px phone, and without
 * it flexbox squeezed them to 28px and still pushed the last one off-screen.
 */
const TOP_BAR_BUTTON =
  'shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full border-[1.5px] border-navy/25 text-navy hover:border-navy hover:bg-white dark:border-white/25 dark:text-biscuit dark:hover:border-biscuit dark:hover:bg-night-raised transition-colors active:scale-95';

/** The orange count on the bell and the bag: navy on color, ringed in paper. */
const COUNT_BADGE =
  'absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 inline-flex items-center justify-center text-2xs font-extrabold leading-none text-navy bg-brand-500 rounded-full ring-2 ring-biscuit dark:ring-night-surface';

/** Sun/moon with a little sunrise rotation on toggle. */
function ThemeGlyph({ theme }: { theme: string }) {
  return (
    <motion.span
      key={theme}
      initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
      animate={{ rotate: 0, opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="inline-flex"
    >
      {theme === 'dark' ? <Sun size={17} aria-hidden /> : <BrandIcon name="moon" size={18} />}
    </motion.span>
  );
}

export default function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { resolved: theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  // Cart badge — consumer accounts only (rescues have a separate nav surface).
  const isShopper = isAuthenticated && user?.role !== 'rescue';
  const { count: cartCount } = useCart(isShopper);
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['inbox-unread'],
    queryFn: getUnreadCount,
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const flags = usePublicFlags();
  // /app/cart sits behind the shop flag, so the icon follows it — otherwise
  // every screen carries a button that opens "Coming soon".
  const showCart = isShopper && flags.explore_enabled && flags.explore_shop_enabled;
  const showVerifyBanner = isAuthenticated && user && !user.is_verified && !bannerDismissed;

  // Close the Explore sheet on navigation so it doesn't linger when the user
  // picks an item or hits back.
  useEffect(() => {
    setExploreOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    // In an admin "log in as" tab, logging out means leaving that session —
    // not ending the admin's own. logout() clears the refresh token from
    // localStorage, which every tab shares, so it used to sign the admin out
    // everywhere while this tab stayed impersonating.
    if (impersonationToken()) {
      exitImpersonation();
      return;
    }
    const rt = getRefreshToken();
    if (rt) {
      try {
        await apiLogout(rt);
      } catch {
        // ignore
      }
    }
    // Clear auth, then do a FULL-DOCUMENT navigation to the landing page.
    // A client-side navigate would leave the page we're logging out from
    // mounted during its route-exit animation (AnimatePresence), where it
    // re-renders with user=null and can crash into the ErrorBoundary. A hard
    // load unmounts the whole authenticated tree at once and starts clean.
    logout();
    window.location.assign('/');
  };

  // Rescue accounts get their own bottom-nav — different product surface, so
  // we hide the consumer tabs (Swipe, Rescues map, Explore) entirely.
  const navItems: readonly NavItem[] =
    user?.role === 'rescue'
      ? [
          { path: '/app/rescue/dashboard', label: 'Dashboard', icon: 'rescue' },
          { path: '/app/pets/new', label: 'Post', icon: 'plus' },
          { path: '/app/lost', label: 'Lost', icon: 'lost' },
          { path: `/app/users/${user.id}`, label: 'Profile', icon: 'user' },
        ]
      : CONSUMER_NAV_ITEMS;

  // Publish the tab bar's real rendered height (content + safe-area inset)
  // as --tab-bar-h on <html>, so layouts can reserve exactly that much space.
  // Measured, not hardcoded: AppShell's fixed-viewport screens pad by this
  // var, and a guessed constant here would silently drift the way the old
  // `h-[calc(100vh-56px)]` navbar guess did.
  const tabBarRef = useCallback((el: HTMLDivElement | null) => {
    const root = document.documentElement;
    if (!el) {
      root.style.removeProperty('--tab-bar-h');
      return;
    }
    const update = () => root.style.setProperty('--tab-bar-h', `${el.offsetHeight}px`);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    // No explicit disconnect: the observer dies with the element, and the
    // callback ref runs with null on unmount to clear the property.
  }, []);

  const onExploreDestination = EXPLORE_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );
  const activePath = navItems.find((item) => {
    if (item.path === '__explore__') return onExploreDestination;
    // Subpages keep their tab lit: /app/rescues/browse → Rescues,
    // /app/lost/:id → Lost. The trailing slash prevents sibling-prefix
    // false positives.
    return (
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`)
    );
  })?.path;

  return (
    <>
      {/* Top bar */}
      <nav className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 px-4 glass border-b border-navy/10 dark:border-white/10">
        <Link
          to={
            isAuthenticated
              ? user?.role === 'rescue'
                ? '/app/rescue/dashboard'
                : '/app/home'
              : '/'
          }
          aria-label="Fetchpawz home"
          className="flex min-w-0 items-center text-[22px] text-navy dark:text-biscuit transition-transform duration-150 ease-soft-out active:scale-[0.98]"
        >
          {/* Admins carry a sixth control; below the 420px app column there
              is no room for it and the wordmark, so the mark stands alone. */}
          {user?.role === 'admin' ? (
            <>
              <PawMark decorative className="h-[26px] w-[26px] text-brand-500 min-[420px]:hidden" />
              <Lockup className="hidden min-[420px]:inline-flex" />
            </>
          ) : (
            <Lockup />
          )}
        </Link>
        {isAuthenticated ? (
          <div className="flex shrink-0 items-center gap-2">
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                aria-label="Admin"
                title="Admin"
                className={TOP_BAR_BUTTON}
              >
                <BrandIcon name="shield" size={18} />
              </Link>
            )}
            {/* Rescues used to have a small "Rescue" top-bar link here;
                their bottom nav now exposes Dashboard directly. */}
            {user?.role !== 'rescue' && (
              <Link
                to={`/app/users/${user?.id}`}
                aria-label="Profile"
                title="Profile"
                className={TOP_BAR_BUTTON}
              >
                <BrandIcon name="user" size={18} />
              </Link>
            )}
            <Link
              to="/app/notifications"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              title="Notifications"
              className={`relative ${TOP_BAR_BUTTON}`}
            >
              <BrandIcon name="bell" size={18} style={{ '--bean': unreadCount > 0 ? 'transparent' : undefined } as React.CSSProperties} />
              {unreadCount > 0 && (
                <span className={COUNT_BADGE}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            {showCart && (
              <Link
                to="/app/cart"
                aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}
                title="Cart"
                className={`relative ${TOP_BAR_BUTTON}`}
              >
                <BrandIcon name="bag" size={18} />
                {cartCount > 0 && (
                  <span className={COUNT_BADGE}>
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`text-sm leading-none ${TOP_BAR_BUTTON}`}
            >
              <ThemeGlyph theme={theme} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className={TOP_BAR_BUTTON}
            >
              <LogOut size={17} aria-hidden />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`text-sm leading-none ${TOP_BAR_BUTTON}`}
            >
              <ThemeGlyph theme={theme} />
            </button>
            {/* Coming-soon gate: the app isn't open to the public yet, so the
                only entry point is Log in (beta testers + team). Public
                sign-up is intentionally not surfaced on the marketing shell. */}
            <Link
              to="/login"
              className="inline-flex min-h-[36px] items-center rounded-full border-2 border-navy bg-brand-500 px-4 font-extrabold text-navy shadow-ledge-sm transition-transform duration-150 ease-soft-out hover:-translate-y-px active:translate-y-[2px] active:shadow-none"
            >
              Log in
            </Link>
          </div>
        )}
      </nav>

      {/* Email verification banner */}
      {showVerifyBanner && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-navy-100 dark:bg-night-raised border-b border-navy/10 dark:border-white/10 text-sm font-semibold text-navy dark:text-biscuit animate-fade-in-up">
          <span className="flex items-center gap-2">
            <BrandIcon name="mail" size={18} />
            Verify your email to unlock everything.
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-navy/10 dark:hover:bg-white/10"
            aria-label="Dismiss"
          >
            <BrandIcon name="close" size={16} />
          </button>
        </div>
      )}

      {/* Bottom tab bar (authenticated only) */}
      {isAuthenticated && (
        <div
          ref={tabBarRef}
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-navy/10 dark:bg-night-surface/95 dark:border-white/10 safe-bottom"
        >
          <div className="mx-auto max-w-app flex px-1 pt-1.5 pb-1.5">
            {navItems.map((item) => {
              const { path, label } = item;
              const isActive = activePath === path;
              const isSheet = 'isSheet' in item && item.isSheet;
              // Explore fully off (admin flag) => greyed, non-opening "Soon" tab.
              const exploreDisabled = isSheet && !flags.explore_enabled;
              const displayLabel = exploreDisabled ? 'Soon' : label;
              // Labels always on. The current tab gets an orange pill behind its
              // icon (navy ink, white bean); the rest are muted navy with the
              // bean in the same ink.
              const itemClasses = `relative flex flex-1 flex-col items-center gap-1 px-1 pt-1 pb-1 min-h-[54px] transition-colors duration-200 ease-soft-out ${
                exploreDisabled
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : isActive
                    ? 'text-navy dark:text-biscuit'
                    : 'text-gray-500 dark:text-gray-400 hover:text-navy dark:hover:text-biscuit'
              }`;
              const content = (
                <>
                  <span className="relative inline-flex h-8 w-14 items-center justify-center">
                    {isActive && (
                      <motion.span
                        layoutId="tab-indicator"
                        className="absolute inset-0 rounded-full border-2 border-navy bg-brand-500 dark:border-transparent"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    {/* the wag when the tab becomes active */}
                    <motion.span
                      className={`relative leading-none ${isActive ? 'text-navy' : ''}`}
                      style={
                        { '--bean': isActive ? '#FFFFFF' : 'currentColor' } as React.CSSProperties
                      }
                      animate={
                        isActive && !reduceMotion ? { rotate: [0, -12, 9, -3, 0] } : { rotate: 0 }
                      }
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <BrandIcon name={item.icon} size={24} />
                    </motion.span>
                  </span>
                  <span
                    className={`text-[11px] leading-none tracking-tight ${isActive ? 'font-extrabold' : 'font-bold'}`}
                  >
                    {displayLabel}
                  </span>
                </>
              );

              if (isSheet) {
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={exploreDisabled ? undefined : () => setExploreOpen((v) => !v)}
                    disabled={exploreDisabled}
                    aria-label={exploreDisabled ? `${label} — coming soon` : label}
                    aria-haspopup={exploreDisabled ? undefined : 'dialog'}
                    aria-expanded={exploreDisabled ? undefined : exploreOpen}
                    title={exploreDisabled ? 'Coming soon' : undefined}
                    className={itemClasses}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <Link
                  key={path}
                  to={path}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                  className={itemClasses}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {isAuthenticated && (
        <ExploreSheet open={exploreOpen} onClose={() => setExploreOpen(false)} />
      )}
    </>
  );
}
