import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import Lockup from '../components/brand/Lockup';

/**
 * Centered, responsive shell for the auth screens (login / signup / password
 * reset / email verify). Keeps them off the 420px app column so they read well
 * on desktop, while the individual pages keep their own hero + form card.
 * Biscuit page (Night Walk after dark) with the drawn lockup at the top.
 */
export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-biscuit dark:bg-night text-navy dark:text-biscuit">
      <header className="border-b border-navy/10 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="group/logo flex items-center text-[22px] text-navy dark:text-biscuit transition-transform duration-150 ease-soft-out active:scale-[0.98]"
          >
            <Lockup wag />
          </Link>
          <Link
            to="/"
            className="text-sm font-bold text-gray-600 dark:text-gray-300 transition-colors hover:text-navy dark:hover:text-biscuit"
          >
            ← Back to site
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" aria-live="polite" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
