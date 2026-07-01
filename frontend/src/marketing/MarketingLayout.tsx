import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import PawMark from '../components/ui/PawMark';

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
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10'
        : 'text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-800/60'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Site header */}
      <header className="sticky top-0 z-50 glass border-b border-gray-200/60 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-lg font-bold tracking-tight text-brand-600 transition-colors hover:text-brand-700 active:scale-[0.98]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-brand-glow">
                <PawMark className="h-[24px] w-[24px]" />
              </span>
              <span>Fetch</span>
              <span className="ml-1 hidden rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-brand-600 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-500/30 sm:inline">
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
                className="text-sm leading-none w-9 h-9 inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-soft-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-95"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>

              {/* Gated: no public login. Session-holders still get "Open app". */}
              {isAuthenticated && (
                <Link
                  to={appHref}
                  className="hidden sm:inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-soft-sm transition-all duration-200 ease-soft-out hover:bg-brand-600 hover:shadow-brand-glow active:scale-95"
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
                className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 active:scale-95"
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
            className="md:hidden border-t border-gray-200/60 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md"
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
                  className="mt-1 inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft-sm active:scale-95"
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
        <Outlet />
      </main>

      <MarketingFooter />
    </div>
  );
}

function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-gray-200/70 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Brand blurb */}
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-brand-glow">
                <PawMark className="h-[24px] w-[24px]" />
              </span>
              <span className="text-lg font-bold tracking-tight text-brand-600">Fetch</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              A home for dog people — rate good dogs, crown a weekly top pup, and
              help lost dogs find their way home. Currently in active development.
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-400 ring-1 ring-brand-200 dark:ring-brand-500/30">
              <span aria-hidden>🚧</span> Available soon
            </p>
          </div>

          {/* Site links */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Explore
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact / access */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Get in touch
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                {/* TODO(about-us): swap in your real contact address. */}
                <a
                  href="mailto:hello@fetchapp.dev"
                  className="text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  hello@fetchapp.dev
                </a>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  Beta / team log in
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-gray-100 dark:border-gray-800 pt-6 text-xs text-gray-400 dark:text-gray-500">
          © {year} Fetch. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
