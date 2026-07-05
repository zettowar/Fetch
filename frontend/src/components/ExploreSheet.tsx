import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ExploreItem {
  label: string;
  description: string;
  icon: string;
  to?: string;
  disabled?: boolean;
  featured?: boolean;
}

const ITEMS: ExploreItem[] = [
  {
    label: 'Parks',
    description: 'Find dog-friendly parks around you.',
    icon: '🌳',
    to: '/app/parks',
  },
  {
    label: 'The Pack',
    description: 'Browse other Fetch users and their dogs.',
    icon: '🐾',
    to: '/app/explore',
    featured: true,
  },
  {
    label: 'Donate',
    description: 'Support Fetch and local rescues.',
    icon: '💖',
    to: '/app/donate',
  },
  {
    label: 'Shop',
    description: 'Branded gear for you and your dog.',
    icon: '🛍️',
    to: '/app/shop',
  },
  {
    label: 'Vets',
    description: 'Find a vet near you.',
    icon: '🩺',
    to: '/app/vets',
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

// Bottom-anchored sheet that slides up from above the tab bar. Mirrors the
// pattern in native iOS/Android share sheets — drag/tap the handle to close,
// tap the backdrop to dismiss, Esc to close on keyboards.
export default function ExploreSheet({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Prevent the page behind the sheet from scrolling while it's open.
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
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            aria-hidden
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Explore"
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
            // Centered with mx-auto, not left-1/2 -translate-x-1/2: framer-motion
            // owns this element's inline transform for the slide-up, which would
            // clobber a class-based translateX and shove the sheet half offscreen.
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-app rounded-t-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 pb-[calc(env(safe-area-inset-bottom)+16px)]"
          >
            {/* Drag handle */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close explore menu"
              className="w-full pt-3 pb-1 flex justify-center"
            >
              <span className="block h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-700" />
            </button>

            <div className="px-4 pt-1 pb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-bold tracking-tight">Explore</h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">Tap to open</span>
            </div>

            <ul className="px-2 pb-2">
              {ITEMS.map((item) => {
                const baseRow =
                  'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors';
                if (item.disabled || !item.to) {
                  return (
                    <li key={item.label}>
                      <div
                        aria-disabled
                        className={`${baseRow} cursor-not-allowed opacity-60`}
                      >
                        <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl" aria-hidden>
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            {item.label}
                            <span className="inline-flex items-center px-1.5 py-0 text-[10px] font-semibold tracking-wide uppercase bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full">
                              Soon
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
                        </div>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      onClick={onClose}
                      className={`${baseRow} ${
                        item.featured
                          ? 'bg-gradient-to-r from-brand-50 to-amber-50 dark:from-brand-500/10 dark:to-amber-500/10 ring-1 ring-brand-200 dark:ring-brand-500/30 shadow-brand-glow hover:from-brand-100 hover:to-amber-100 dark:hover:from-brand-500/20 dark:hover:to-amber-500/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      } active:scale-[0.99]`}
                    >
                      <span
                        className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                          item.featured
                            ? 'bg-gradient-to-br from-brand-400 to-amber-500 text-white shadow-brand-glow'
                            : 'bg-brand-50 dark:bg-brand-500/15'
                        }`}
                        aria-hidden
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          {item.label}
                          {item.featured && (
                            <span className="inline-flex items-center px-1.5 py-0 text-[10px] font-bold tracking-wide uppercase bg-gradient-to-r from-brand-500 to-amber-500 text-white rounded-full shadow-brand-glow">
                              Pack+
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
                      </div>
                      <span aria-hidden className="text-gray-300 dark:text-gray-600">›</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
