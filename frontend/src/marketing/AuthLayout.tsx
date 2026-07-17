import { Link, Outlet } from 'react-router-dom';
import PawMark from '../components/ui/PawMark';

/**
 * Centered, responsive shell for the auth screens (login / signup / password
 * reset / email verify). Keeps them off the 420px app column so they read well
 * on desktop, while the individual pages keep their own hero + form card.
 */
export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200/60 dark:border-gray-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-brand-600 transition-colors hover:text-brand-700 active:scale-[0.98]"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-brand-glow">
              <PawMark className="h-[24px] w-[24px]" />
            </span>
            <span>Fetchpawz</span>
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors hover:text-brand-600 dark:hover:text-brand-400"
          >
            ← Back to site
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
