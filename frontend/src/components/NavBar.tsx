import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
    logout();
    navigate('/');
  };

  return (
    <>
      {/* Top bar */}
      <nav className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100">
        <Link to={isAuthenticated ? '/home' : '/'} className="text-lg font-bold text-brand-600">
          Fetch
        </Link>
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            {user?.role === 'admin' && (
              <Link to="/admin" className="text-xs text-gray-500 hover:text-brand-500 transition-colors font-medium">
                Admin
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <Link to="/login" className="text-gray-600 hover:text-brand-500">
              Log in
            </Link>
            <Link
              to="/signup"
              className="bg-brand-500 text-white px-3 py-1.5 rounded-lg hover:bg-brand-600 transition-colors"
            >
              Sign up
            </Link>
          </div>
        )}
      </nav>

      {/* Email verification banner */}
      {showVerifyBanner && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
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
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
          <div className="mx-auto max-w-app flex justify-around py-1.5">
            {NAV_ITEMS.map(({ path, label, icon }) => {
              const isActive = location.pathname === path ||
                (path === '/dogs' && location.pathname.startsWith('/dogs')) ||
                (path === '/lost' && location.pathname.startsWith('/lost')) ||
                (path === '/parks' && location.pathname.startsWith('/parks'));
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[3rem] ${
                    isActive
                      ? 'text-brand-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <span className="text-lg leading-none">{icon}</span>
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
