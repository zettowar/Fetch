import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { logout as apiLogout } from '../api/auth';
import { getRefreshToken } from '../api/client';
import { useCart } from '../utils/useCart';
import PawMark from './ui/PawMark';
import ExploreSheet from './ExploreSheet';
import SignupChooserSheet from './SignupChooserSheet';

// Paths that the Explore sheet routes to — used to mark the tab "active"
// when any of those destinations is showing.
const EXPLORE_PATHS = ['/app/explore', '/app/parks', '/app/vets'] as const;

type NavItem = {
  path: string;
  label: string;
  icon: string;
  isSheet?: boolean;
};

const CONSUMER_NAV_ITEMS: readonly NavItem[] = [
  { path: '/app/home', label: 'Home', icon: '🦴' },
  { path: '/app/swipe', label: 'Swipe', icon: '❤️' },
  { path: '/app/rescues', label: 'Rescues', icon: '🏠' },
  { path: '/app/lost', label: 'Lost', icon: '🚨' },
  { path: '__explore__', label: 'Explore', icon: '🔍', isSheet: true },
];

export default function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { resolved: theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  // Cart badge — consumer accounts only (rescues have a separate nav surface).
  const isShopper = isAuthenticated && user?.role !== 'rescue';
  const { count: cartCount } = useCart(isShopper);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [signupChooserOpen, setSignupChooserOpen] = useState(false);
  const showVerifyBanner = isAuthenticated && user && !user.is_verified && !bannerDismissed;

  // Close any open sheets on navigation so they don't linger when the user
  // picks an item or hits back.
  useEffect(() => {
    setExploreOpen(false);
    setSignupChooserOpen(false);
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
          { path: '/app/rescue/dashboard', label: 'Dashboard', icon: '🦴' },
          { path: '/app/dogs/new', label: 'Post', icon: '➕' },
          { path: '/app/lost', label: 'Lost', icon: '🚨' },
          { path: `/app/users/${user.id}`, label: 'Profile', icon: '👤' },
        ]
      : CONSUMER_NAV_ITEMS;

  const onExploreDestination = EXPLORE_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );
  const activePath = navItems.find((item) => {
    if (item.path === '__explore__') return onExploreDestination;
    if (location.pathname === item.path) return true;
    return false;
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
          <span>Fetch</span>
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
                className="text-xs text-gray-500 dark:text-gray-400 transition-colors hover:text-brand-500"
              >
                Profile
              </Link>
            )}
            {isShopper && (
              <Link
                to="/app/cart"
                aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}
                title="Cart"
                className="relative w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-soft-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-95 text-gray-600 dark:text-gray-300"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-[18px] h-[18px]" aria-hidden>
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 6h18" strokeWidth={2} strokeLinecap="round" />
                  <path d="M16 10a4 4 0 0 1-8 0" strokeWidth={2} strokeLinecap="round" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 inline-flex items-center justify-center text-[10px] font-bold leading-none text-white bg-brand-500 rounded-full">
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
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 dark:text-gray-400 transition-colors hover:text-red-500 dark:text-red-400"
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
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <Link to="/login" className="text-gray-600 dark:text-gray-300 transition-colors hover:text-brand-500">
              Log in
            </Link>
            <button
              type="button"
              onClick={() => setSignupChooserOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={signupChooserOpen}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-white shadow-soft-sm transition-all duration-200 ease-soft-out hover:bg-brand-600 hover:shadow-brand-glow active:scale-95"
            >
              Sign up
            </button>
          </div>
        )}
      </nav>

      {/* Email verification banner */}
      {showVerifyBanner && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30 text-sm text-amber-800 dark:text-amber-200 animate-fade-in-up">
          <span>Please verify your email address to unlock all features.</span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:text-amber-200 font-bold leading-none flex-shrink-0"
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
              const { path, label, icon } = item;
              const isActive = activePath === path;
              const isSheet = 'isSheet' in item && item.isSheet;
              const itemClasses = `relative flex flex-1 flex-col items-center gap-1 px-2 pt-2.5 pb-2 min-h-[53px] transition-colors duration-200 ease-soft-out ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
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
                  <span
                    className={`text-[29px] leading-none transition-transform duration-200 ease-soft-out ${
                      isActive ? 'scale-110' : ''
                    }`}
                  >
                    {icon}
                  </span>
                  <span className="text-[13px] font-semibold leading-none tracking-tight">
                    {label}
                  </span>
                </>
              );

              if (isSheet) {
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => setExploreOpen((v) => !v)}
                    aria-label={label}
                    aria-haspopup="dialog"
                    aria-expanded={exploreOpen}
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
      {!isAuthenticated && (
        <SignupChooserSheet
          open={signupChooserOpen}
          onClose={() => setSignupChooserOpen(false)}
        />
      )}
    </>
  );
}
