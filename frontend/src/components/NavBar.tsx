import { useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Sun } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { logout as apiLogout } from '../api/auth';
import { exitImpersonation, getRefreshToken, impersonationToken, storedRefreshToken } from '../api/client';
import { getUnreadCount } from '../api/notifications';
import { useCart } from '../utils/useCart';
import Lockup from './brand/Lockup';
import PawMark from './ui/PawMark';
import BrandIcon from './brand/BrandIcon';
import { usePublicFlags } from '../hooks/usePublicFlags';

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

/**
 * The top bar: brand on the left, account controls on the right. The same bar
 * at every size — it spans the window from `sm` up, above the side rail. The
 * app's navigation itself lives in `nav/` (TabBar on a phone, SideNav from
 * `sm`).
 */
export default function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { resolved: theme, toggle: toggleTheme } = useTheme();
  // Cart badge — consumer accounts only (rescues have a separate nav surface).
  const isShopper = isAuthenticated && user?.role !== 'rescue';
  const { count: cartCount } = useCart(isShopper);
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['inbox-unread'],
    queryFn: getUnreadCount,
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });
  const flags = usePublicFlags();
  // /app/cart sits behind the shop flag, so the icon follows it — otherwise
  // every screen carries a button that opens "Coming soon".
  const showCart = isShopper && flags.explore_enabled && flags.explore_shop_enabled;

  const handleLogout = async () => {
    // In an admin "log in as" tab, logging out means leaving that session —
    // not ending the admin's own. logout() clears the refresh token from
    // localStorage, which every tab shares, so it used to sign the admin out
    // everywhere while this tab stayed impersonating.
    if (impersonationToken()) {
      exitImpersonation();
      return;
    }
    // Revoke the token every tab shares, not only the copy in this tab's
    // memory: that one is already spent if another tab refreshed more
    // recently, and revoking it left the live session standing.
    const rt = storedRefreshToken() || getRefreshToken();
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

  return (
    <nav aria-label="Account" className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 px-4 sm:px-5 glass border-b border-navy/10 dark:border-white/10">
      <Link
        to={
          isAuthenticated
            ? user?.role === 'rescue'
              ? '/app/rescue/dashboard'
              : '/app/home'
            : '/'
        }
        aria-label="Fetchpawz home"
        className="group/logo flex min-w-0 items-center text-[22px] text-navy dark:text-biscuit transition-transform duration-150 ease-soft-out active:scale-[0.98]"
      >
        {/* Admins carry a sixth control; below the 420px app column there
            is no room for it and the wordmark, so the mark stands alone. */}
        {user?.role === 'admin' ? (
          <>
            <PawMark decorative className="h-[26px] w-[26px] text-brand-500 min-[420px]:hidden" />
            <Lockup wag className="hidden min-[420px]:inline-flex" />
          </>
        ) : (
          <Lockup wag />
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
              aria-label={cartCount > 0 ? `Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}` : 'Cart'}
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
  );
}

/** Nudge an unverified account to confirm its email. Dismissal lasts until
 *  the next full load. `className` positions it (the shell gives it the
 *  page's column), and renders only when the banner does. */
export function VerifyBanner({ className = '' }: { className?: string }) {
  const { isAuthenticated, user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  if (!isAuthenticated || !user || user.is_verified || dismissed) return null;
  return (
    <div className={className}>
    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-navy-100 dark:bg-night-raised border-b border-navy/10 dark:border-white/10 text-sm font-semibold text-navy dark:text-biscuit animate-fade-in-up sm:mt-4 sm:rounded-2xl sm:border">
      <span className="flex items-center gap-2">
        <BrandIcon name="mail" size={18} />
        Verify your email to unlock everything.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-navy/10 dark:hover:bg-white/10"
        aria-label="Dismiss"
      >
        <BrandIcon name="close" size={16} />
      </button>
    </div>
    </div>
  );
}
