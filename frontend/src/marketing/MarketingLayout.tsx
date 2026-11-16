import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Sun } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import Lockup from '../components/brand/Lockup';
import BrandIcon from '../components/brand/BrandIcon';

/**
 * Chrome for the marketing **website** — the front door every unauthenticated
 * visitor lands on. Unlike the app shell, this is web-first: full-bleed,
 * responsive, and desktop-friendly, with a real site header + footer.
 */

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About', end: false },
  { to: '/mission', label: 'Mission', end: false },
  { to: '/news', label: 'News', end: false },
] as const;

export default function MarketingLayout() {
  const { isAuthenticated, user } = useAuth();
  const { resolved: theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Collapse the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Access is gated until launch: the public sees no login entry in the top
  // bar. Visitors who already have a session still get an "Open app" shortcut.
  // (To reopen public login, restore a `/login` CTA for the logged-out case.)
  const appHref = user?.role === 'rescue' ? '/app/rescue/dashboard' : '/app/home';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3.5 py-2 rounded-full text-sm font-extrabold transition-colors ${
      isActive
        ? 'text-navy bg-navy/[0.07] dark:text-biscuit dark:bg-white/10'
        : 'text-gray-600 dark:text-gray-300 hover:text-navy dark:hover:text-biscuit hover:bg-navy/5 dark:hover:bg-white/5'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-biscuit dark:bg-night text-navy dark:text-biscuit">
      {/* Site header */}
      <header className="sticky top-0 z-50 glass border-b border-navy/10 dark:border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link
              to="/"
              aria-label="Fetchpawz home"
              className="group/logo flex items-center gap-2.5 text-[26px] text-navy dark:text-biscuit transition-transform active:scale-[0.98]"
            >
              <Lockup wag />
              <span className="hidden rounded-full border-[1.5px] border-navy px-2 py-0.5 text-2xs font-extrabold uppercase tracking-[0.1em] text-navy dark:border-biscuit/40 dark:text-biscuit sm:inline">
                Beta
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={navLinkClass}>
                  {l.label}
                </NavLink>
              ))}
            </nav>

            {/* Right cluster */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="btn-icon text-sm leading-none"
              >
                {theme === 'dark' ? <Sun size={17} aria-hidden /> : <BrandIcon name="moon" size={18} />}
              </button>

              {/* Gated: no public login. Session-holders still get "Open app". */}
              {isAuthenticated && (
                <Link
                  to={appHref}
                  className="btn btn-primary btn-sm hidden sm:inline-flex"
                >
                  Open app
                </Link>
              )}

              {/* Mobile menu toggle */}
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu"
                aria-expanded={menuOpen}
                aria-controls="marketing-mobile-menu"
                className="btn-icon md:hidden"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" aria-hidden>
                  {menuOpen ? (
                    <path d="M6 6l12 12M18 6L6 18" strokeWidth={2} strokeLinecap="round" />
                  ) : (
                    <path d="M4 7h16M4 12h16M4 17h16" strokeWidth={2} strokeLinecap="round" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div
            id="marketing-mobile-menu"
            className="md:hidden border-t border-navy/10 dark:border-white/10 bg-biscuit/95 dark:bg-night/95 backdrop-blur-md"
          >
            <nav className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={navLinkClass}>
                  {l.label}
                </NavLink>
              ))}
              {isAuthenticated && (
                <Link
                  to={appHref}
                  className="btn btn-primary mt-2"
                >
                  Open app
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        {/* Its own boundary, like the app shell's: with only the one above
            the layout, a page whose chunk wasn't cached blanked the header
            and footer along with the page. */}
        <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" aria-live="polite" />}>
          <Outlet />
        </Suspense>
      </main>

      <MarketingFooter />
    </div>
  );
}

function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-navy text-biscuit">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Brand blurb */}
          <div>
            <div className="text-[30px] text-biscuit">
              <Lockup />
            </div>
            <p className="mt-4 font-display text-2xl leading-tight text-biscuit">The pet app with a rescue mission.</p>
            <p className="mt-2 max-w-sm text-sm text-navy-200 leading-relaxed">
              Swipe for fun, rescue for real — the feed, the dog park,
              Lost & Found, and adoptable rescues in the deck. In development
              now.
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-brand-500 px-3 py-1 text-2xs font-extrabold uppercase tracking-[0.1em] text-brand-400">
              <BrandIcon name="clock" size={14} /> Available soon
            </p>
          </div>

          {/* Site links */}
          <div>
            <p className="text-2xs font-extrabold uppercase tracking-[0.1em] text-navy-300">
              Explore
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="font-semibold text-biscuit/85 hover:text-brand-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact / access */}
          <div>
            <p className="text-2xs font-extrabold uppercase tracking-[0.1em] text-navy-300">
              Get in touch
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="mailto:fetchpawz.inc@gmail.com"
                  className="font-semibold text-biscuit/85 hover:text-brand-400 transition-colors"
                >
                  fetchpawz.inc@gmail.com
                </a>
              </li>
              <li>
                <Link
                  to="/login"
                  className="font-semibold text-biscuit/85 hover:text-brand-400 transition-colors"
                >
                  Beta / team log in
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-navy-300">
          <span>© {year} Fetchpawz Inc. All rights reserved.</span>
          <Link to="/privacy" className="hover:text-brand-400 transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-brand-400 transition-colors">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
