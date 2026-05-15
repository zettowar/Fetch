import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { logout as apiLogout } from '../api/auth';
import { getRefreshToken } from '../api/client';
import PawMark from './ui/PawMark';

const NAV_ITEMS = [
  { path: '/home', label: 'Home', icon: '🏠' },
  { path: '/swipe', label: 'Swipe', icon: '❤️' },
  { path: '/dogs', label: 'Dogs', icon: '🐶' },
  { path: '/lost', label: 'Lost', icon: '🚨' },
  { path: '/parks', label: 'Parks', icon: '🌳', hasMenu: true },
] as const;

const PARKS_MENU = [
  { path: '/parks', label: 'Explore Parks', icon: '🌳' },
  { path: '/vets', label: 'Explore Vets', icon: '🩺', disabled: true },
  { path: '/explore', label: 'Explore the Pack', icon: '🐾' },
] as const;

export default function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { resolved: theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [parksMenuOpen, setParksMenuOpen] = useState(false);
  const parksMenuRef = useRef<HTMLDivElement | null>(null);
  const showVerifyBanner = isAuthenticated && user && !user.is_verified && !bannerDismissed;

  useEffect(() => {
    if (!parksMenuOpen) return;
    const close = (e: Event) => {
      if (!parksMenuRef.current?.contains(e.target as Node)) setParksMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setParksMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [parksMenuOpen]);

  useEffect(() => {
    setParksMenuOpen(false);
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

  const activePath = NAV_ITEMS.find(({ path }) => {
    if (location.pathname === path) return true;
    if (path === '/dogs' && location.pathname.startsWith('/dogs')) return true;
    if (path === '/lost' && location.pathname.startsWith('/lost')) return true;
    if (path === '/parks' && location.pathname.startsWith('/parks')) return true;
    if (path === '/parks' && location.pathname.startsWith('/explore')) return true;
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
              const hasMenu = 'hasMenu' in item && item.hasMenu;
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
                    className={`text-[24px] leading-none transition-transform duration-200 ease-soft-out ${
                      isActive ? 'scale-110' : ''
                    }`}
                  >
                    {icon}
                  </span>
                  <span className="text-[12px] font-semibold leading-none tracking-tight inline-flex items-center gap-0.5">
                    {label}
                    {hasMenu && <span aria-hidden className="text-[8px] opacity-70">▾</span>}
                  </span>
                </>
              );

              if (hasMenu) {
                return (
                  <div key={path} ref={parksMenuRef} className="relative flex-1 flex">
                    <button
                      type="button"
                      onClick={() => setParksMenuOpen((v) => !v)}
                      aria-label={`${label} menu`}
                      aria-expanded={parksMenuOpen}
                      aria-haspopup="menu"
                      className={`${itemClasses} w-full`}
                    >
                      {content}
                    </button>
                    <AnimatePresence>
                      {parksMenuOpen && (
                        <motion.div
                          role="menu"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                          className="absolute bottom-full right-0 mb-2 min-w-[180px] rounded-xl bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/10 overflow-hidden"
                        >
                          {PARKS_MENU.map((entry) => {
                            const disabled = 'disabled' in entry && entry.disabled;
                            return disabled ? (
                              <div
                                key={entry.label}
                                role="menuitem"
                                aria-disabled
                                className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed"
                              >
                                <span className="flex items-center gap-2">
                                  <span aria-hidden>{entry.icon}</span>
                                  {entry.label}
                                </span>
                                <span className="text-[10px] uppercase tracking-wide">Soon</span>
                              </div>
                            ) : (
                              <Link
                                key={entry.label}
                                to={entry.path}
                                role="menuitem"
                                onClick={() => setParksMenuOpen(false)}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                <span aria-hidden>{entry.icon}</span>
                                {entry.label}
                              </Link>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
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
    </>
  );
}
