import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Bottom-sheet that asks "Which path?" before sending the visitor to one of
 * the two signup forms. We surface this from the top-bar "Sign up" button so
 * the dual-path framing on the landing page carries through into the funnel
 * — otherwise that header CTA quietly defaults rescues into the owner form.
 *
 * Mirrors the interaction pattern of `ExploreSheet`: drag/tap the handle to
 * close, tap the backdrop to dismiss, Esc to close.
 */
export default function SignupChooserSheet({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            aria-hidden
          />

          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Choose signup path"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 600) onClose();
            }}
            className="fixed left-1/2 -translate-x-1/2 bottom-0 z-50 w-full max-w-app rounded-t-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 pb-[calc(env(safe-area-inset-bottom)+16px)]"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close signup chooser"
              className="w-full pt-3 pb-1 flex justify-center"
            >
              <span className="block h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-700" />
            </button>

            <div className="px-5 pt-1 pb-2">
              <h2 className="text-lg font-bold tracking-tight">Join Fetch</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Two paths — pick the one that's you.
              </p>
            </div>

            <div className="px-4 pt-2 pb-3 flex flex-col gap-3">
              <Link
                to="/signup"
                onClick={onClose}
                className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-brand-200 dark:ring-brand-500/30 shadow-brand-glow p-4 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-brand-glow flex items-center justify-center text-2xl leading-none"
                  >
                    🐶
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-widest font-semibold text-brand-600 dark:text-brand-400">
                      Dog owners
                    </p>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">
                      I have a dog
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Swipe, follow, crown the weekly top pup.
                    </p>
                  </div>
                  <span aria-hidden className="text-brand-500 dark:text-brand-400 text-lg">
                    →
                  </span>
                </div>
              </Link>

              <Link
                to="/signup-rescue"
                onClick={onClose}
                className="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-purple-200 dark:ring-purple-500/30 shadow-[0_8px_24px_-8px_rgba(147,51,234,0.35)] p-4 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-[0_8px_24px_-8px_rgba(147,51,234,0.45)] flex items-center justify-center text-2xl leading-none"
                  >
                    🏠
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-widest font-semibold text-purple-600 dark:text-purple-400">
                      Rescues &amp; partners
                    </p>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">
                      I run a rescue
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      List adoptable dogs and manage inquiries.
                    </p>
                  </div>
                  <span aria-hidden className="text-purple-500 dark:text-purple-400 text-lg">
                    →
                  </span>
                </div>
              </Link>
            </div>

            <p className="px-5 pb-2 text-center text-xs text-gray-400 dark:text-gray-500">
              Already have an account?{' '}
              <Link
                to="/login"
                onClick={onClose}
                className="text-brand-600 dark:text-brand-400 font-medium hover:underline"
              >
                Log in
              </Link>
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
