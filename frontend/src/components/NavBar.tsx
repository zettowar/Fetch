import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bell,
  Bone,
  CirclePlus,
  Compass,
  Heart,
  HousePlus,
  LayoutDashboard,
  Moon,
  ShoppingBag,
  Siren,
  Sun,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { logout as apiLogout } from '../api/auth';
import { getRefreshToken } from '../api/client';
import { getUnreadCount } from '../api/notifications';
import { useCart } from '../utils/useCart';
import PawMark from './ui/PawMark';
import ExploreSheet from './ExploreSheet';
import { usePublicFlags } from '../hooks/usePublicFlags';

// Paths that the Explore sheet routes to — used to mark the tab "active"
// when any of those destinations is showing.
const EXPLORE_PATHS = ['/app/explore', '/app/parks', '/app/vets'] as const;

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Fill the glyph when active — only for shapes that read well solid. */
  fillActive?: boolean;
  isSheet?: boolean;
};

const CONSUMER_NAV_ITEMS: readonly NavItem[] = [
  { path: '/app/home', label: 'Home', icon: Bone, fillActive: true },
  { path: '/app/swipe', label: 'Swipe', icon: Heart, fillActive: true },
  { path: '/app/rescues', label: 'Rescues', icon: HousePlus },
  { path: '/app/lost', label: 'Lost', icon: Siren },
  { path: '__explore__', label: 'Explore', icon: Compass, isSheet: true },
];

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
      {theme === 'dark' ? (
        <Sun size={18} aria-hidden className="text-warning-500" />
      ) : (
        <Moon size={18} aria-hidden className="text-gray-500 dark:text-gray-300" />
      )}
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
  const showVerifyBanner = isAuthenticated && user && !user.is_verified && !bannerDismissed;

  // Close the Explore sheet on navigation so it doesn't linger when the user
  // picks an item or hits back.
  useEffect(() => {
    setExploreOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
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
          { path: '/app/rescue/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { path: '/app/pets/new', label: 'Post', icon: CirclePlus },
          { path: '/app/lost', label: 'Lost', icon: Siren },
          { path: `/app/users/${user.id}`, label: 'Profile', icon: UserRound },
        ]
      : CONSUMER_NAV_ITEMS;

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
      <nav className="sticky top-0 z-40 flex items-center justify-between px-4 py-2.5 glass border-b border-gray-200/60 dark:border-gray-800">
        <Link
          to={
            isAuthenticated
              ? user?.role === 'rescue'
                ? '/app/rescue/dashboard'
                : '/app/home'
              : '/'
          }
          className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-brand-600 transition-colors duration-200 ease-soft-out hover:text-brand-700 active:scale-[0.98]"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-brand-glow">
            <PawMark className="h-[22px] w-[22px]" />
          </span>
          <span>Fetchpawz</span>
        </Link>
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="text-xs font-medium text-gray-500 dark:text-gray-400 transition-colors hover:text-brand-500"
              >
                Admin
              </Link>
            )}
            {/* Rescues used to have a small "Rescue" top-bar link here;
                their bottom nav now exposes Dashboard directly. */}
            {user?.role !== 'rescue' && (
              <Link
                to={`/app/users/${user?.id}`}
                aria-label="Profile"
                title="Profile"
                className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-soft-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-95 text-gray-600 dark:text-gray-300"
              >
                <UserRound size={18} aria-hidden />
              </Link>
            )}
            <Link
              to="/app/notifications"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              title="Notifications"
              className="relative w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-soft-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-95 text-gray-600 dark:text-gray-300"
            >
              <Bell size={18} aria-hidden />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 inline-flex items-center justify-center text-2xs font-bold leading-none text-white bg-brand-500 rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            {isShopper && (
              <Link
                to="/app/cart"
                aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}
                title="Cart"
                className="relative w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-soft-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-95 text-gray-600 dark:text-gray-300"
              >
                <ShoppingBag size={18} aria-hidden />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 inline-flex items-center justify-center text-2xs font-bold leading-none text-white bg-brand-500 rounded-full">
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
              className="text-sm leading-none w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-soft-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-95"
            >
              <ThemeGlyph theme={theme} />
            </button>
            <button
              onClick={handleLogout}
              className="h-8 px-3 inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-soft-sm text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-red-500 dark:hover:text-red-400 transition-colors active:scale-95"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="text-sm leading-none w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-soft-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-95"
            >
              <ThemeGlyph theme={theme} />
            </button>
            {/* Coming-soon gate: the app isn't open to the public yet, so the
                only entry point is Log in (beta testers + team). Public
                sign-up is intentionally not surfaced on the marketing shell. */}
            <Link
              to="/login"
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-white shadow-soft-sm transition-all duration-200 ease-soft-out hover:bg-brand-600 hover:shadow-brand-glow active:scale-95"
            >
              Log in
            </Link>
          </div>
        )}
      </nav>

      {/* Email verification banner */}
      {showVerifyBanner && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-warning-50 dark:bg-warning-500/10 border-b border-warning-200 dark:border-warning-500/30 text-sm text-warning-800 dark:text-warning-200 animate-fade-in-up">
          <span>Please verify your email address to unlock all features.</span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-warning-600 dark:text-warning-400 hover:text-warning-800 dark:hover:text-warning-200 font-bold leading-none flex-shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Bottom tab bar (authenticated only) */}
      {isAuthenticated && (
        <div className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-gray-200/60 dark:border-gray-800 safe-bottom">
          <div className="mx-auto max-w-app flex py-2">
            {navItems.map((item) => {
              const { path, label, icon: Icon } = item;
              const isActive = activePath === path;
              const isSheet = 'isSheet' in item && item.isSheet;
              // Explore fully off (admin flag) => greyed, non-opening "Soon" tab.
              const exploreDisabled = isSheet && !flags.explore_enabled;
              const displayLabel = exploreDisabled ? 'Soon' : label;
              const itemClasses = `relative flex flex-1 flex-col items-center gap-1 px-2 pt-2.5 pb-2 min-h-[53px] transition-colors duration-200 ease-soft-out ${
                exploreDisabled
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`;
              const content = (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-indicator"
                      className="absolute -top-px inset-x-3 h-0.5 rounded-full bg-brand-500"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  {/* tail-wag wiggle when the tab becomes active */}
                  <motion.span
                    className="leading-none"
                    animate={
                      isActive && !reduceMotion
                        ? { rotate: [0, -10, 8, -4, 0], scale: [1, 1.15, 1.08, 1.12, 1.1] }
                        : { rotate: 0, scale: isActive ? 1.1 : 1 }
                    }
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Icon
                      size={26}
                      strokeWidth={isActive ? 2.5 : 2}
                      fill={isActive && item.fillActive ? 'currentColor' : 'none'}
                      aria-hidden
                    />
                  </motion.span>
                  <span className="text-xs font-semibold leading-none tracking-tight">
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
