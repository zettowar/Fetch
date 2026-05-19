import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { logout as apiLogout } from '../api/auth';
import { getRefreshToken } from '../api/client';
import PawMark from './ui/PawMark';
import ExploreSheet from './ExploreSheet';

// Paths that the Explore sheet routes to — used to mark the tab "active"
// when any of those destinations is showing.
const EXPLORE_PATHS = ['/explore', '/parks', '/rescues', '/vets'] as const;

const NAV_ITEMS = [
  { path: '/home', label: 'Home', icon: '🏠' },
  { path: '/swipe', label: 'Swipe', icon: '❤️' },
  { path: '/lost', label: 'Lost', icon: '🚨' },
  { path: '__explore__', label: 'Explore', icon: '🔍', isSheet: true },
] as const;

export default function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { resolved: theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const showVerifyBanner = isAuthenticated && user && !user.is_verified && !bannerDismissed;

  // Close the sheet on navigation so it doesn't linger when the user picks
  // an item or hits back.
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
    // Navigate away from the protected page first so it unmounts cleanly before
    // we null the user — avoids protected-page components briefly rendering
    // with user=null and tripping the ErrorBoundary.
    navigate('/', { replace: true });
    logout();
    queryClient.clear();
  };

  const onExploreDestination = EXPLORE_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );
  const activePath = NAV_ITEMS.find((item) => {
    if (item.path === '__explore__') return onExploreDestination;
    if (location.pathname === item.path) return true;
    if (item.path === '/lost' && location.pathname.startsWith('/lost')) return true;
    return false;
  })?.path;

  return (
    <>
      {/* Top bar */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-4 py-2.5 glass border-b border-gray-200/60 dark:border-gray-800">
        <Link
          to={isAuthenticated ? '/home' : '/'}
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
            {user?.role === 'rescue' && (
              <Link
                to="/rescue/dashboard"
                className="text-xs font-medium text-gray-500 dark:text-gray-400 transition-colors hover:text-brand-500"
              >
                Rescue
              </Link>
            )}
            <Link
              to={`/users/${user?.id}`}
              className="text-xs text-gray-500 dark:text-gray-400 transition-colors hover:text-brand-500"
            >
              Profile
            </Link>
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
            <Link
              to="/signup"
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-white shadow-soft-sm transition-all duration-200 ease-soft-out hover:bg-brand-600 hover:shadow-brand-glow active:scale-95"
            >
              Sign up
            </Link>
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
            {NAV_ITEMS.map((item) => {
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
                    className={`text-[28px] leading-none transition-transform duration-200 ease-soft-out ${
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
    </>
  );
}
