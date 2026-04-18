import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../store/AuthContext';
import { logout as apiLogout } from '../api/auth';
import { getRefreshToken } from '../api/client';

const NAV_ITEMS = [
  { path: '/home', label: 'Home', icon: '\u2302' },
  { path: '/swipe', label: 'Swipe', icon: '\u2764' },
  { path: '/dogs', label: 'Dogs', icon: '\ud83d\udc36' },
  { path: '/lost', label: 'Lost', icon: '\ud83d\udea8' },
  { path: '/parks', label: 'Parks', icon: '\ud83c\udf33' },
  { path: '/rankings', label: 'Top', icon: '\ud83c\udfc6' },
];

export default function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const showVerifyBanner = isAuthenticated && user && !user.is_verified && !bannerDismissed;

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
    return false;
  })?.path;

  return (
    <>
      {/* Top bar */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-4 py-2.5 glass border-b border-gray-200/60">
        <Link
          to={isAuthenticated ? '/home' : '/'}
          className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-brand-600 transition-transform duration-200 ease-soft-out hover:scale-[1.02] active:scale-95"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[12px] text-white shadow-brand-glow">
            🐾
          </span>
          <span>Fetch</span>
        </Link>
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="text-xs font-medium text-gray-500 transition-colors hover:text-brand-500"
              >
                Admin
              </Link>
            )}
            {user?.role === 'rescue' && (
              <Link
                to="/rescue/dashboard"
                className="text-xs font-medium text-gray-500 transition-colors hover:text-brand-500"
              >
                Rescue
              </Link>
            )}
            <Link
              to={`/users/${user?.id}`}
              className="text-xs text-gray-500 transition-colors hover:text-brand-500"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 transition-colors hover:text-red-500"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <Link to="/login" className="text-gray-600 transition-colors hover:text-brand-500">
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
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800 animate-fade-in-up">
          <span>Please verify your email address to unlock all features.</span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-amber-600 hover:text-amber-800 font-bold leading-none flex-shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Bottom tab bar (authenticated only) */}
      {isAuthenticated && (
        <div className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-gray-200/60 safe-bottom">
          <div className="mx-auto max-w-app flex justify-around py-1.5">
            {NAV_ITEMS.map(({ path, label, icon }) => {
              const isActive = activePath === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[3rem] transition-colors duration-200 ease-soft-out ${
                    isActive ? 'text-brand-600' : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-x-2 inset-y-0.5 -z-10 rounded-xl bg-brand-50"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span
                    className={`text-lg leading-none transition-transform duration-200 ease-soft-out ${
                      isActive ? 'scale-110' : ''
                    }`}
                  >
                    {icon}
                  </span>
                  <span className="text-[10px] font-semibold leading-none tracking-tight">
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
