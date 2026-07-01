import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import NavBar from './NavBar';
import FeedbackWidget from './FeedbackWidget';

/**
 * Shell for the authenticated web *app* (`/app/*`).
 *
 * Deliberately mobile-portrait: a centered 420px column with the top bar and
 * bottom tab navigation. This is the product surface — the marketing website
 * (see `marketing/MarketingLayout`) is a separate, web-first experience so the
 * two intents don't bleed into each other.
 */
export default function AppShell() {
  const location = useLocation();

  return (
    <div className="mx-auto max-w-app min-h-screen bg-white dark:bg-gray-900 pb-20 shadow-soft-lg">
      <NavBar />
      <AnimatePresence initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
      {location.pathname === '/app/home' && <FeedbackWidget />}
    </div>
  );
}
