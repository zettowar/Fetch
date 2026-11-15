import { useEffect } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePublicFlags } from '../hooks/usePublicFlags';
import BrandIcon, { type BrandIconName } from './brand/BrandIcon';
import type { PublicFlags } from '../api/publicSite';

interface ExploreItem {
  label: string;
  description: string;
  icon: BrandIconName;
  to?: string;
  disabled?: boolean;
  featured?: boolean;
  // Admin flag that gates this item; off => greyed "Soon".
  flagKey: keyof PublicFlags;
}

const ITEMS: ExploreItem[] = [
  {
    label: 'Parks',
    description: 'Check in, meet up',
    icon: 'park',
    to: '/app/parks',
    flagKey: 'explore_parks_enabled',
  },
  {
    label: 'The Pack',
    description: 'Pack+ perks',
    icon: 'lock',
    to: '/app/explore',
    featured: true,
    flagKey: 'explore_pack_enabled',
  },
  {
    label: 'Donate',
    description: 'Every bone counts',
    icon: 'donate',
    to: '/app/donate',
    flagKey: 'explore_donate_enabled',
  },
  {
    label: 'Shop',
    description: 'Gear for the walk',
    icon: 'bag',
    to: '/app/shop',
    flagKey: 'explore_shop_enabled',
  },
  {
    label: 'Community',
    description: 'Ask the pack',
    icon: 'chat',
    to: '/app/community',
    flagKey: 'explore_community_enabled',
  },
  {
    label: 'Vets',
    description: 'Near you',
    icon: 'vet',
    to: '/app/vets',
    flagKey: 'explore_vets_enabled',
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
  const flags = usePublicFlags();
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
    // Two DIRECT children, never a Fragment. AnimatePresence collects its
    // children with React.Children.forEach, which does not descend into a
    // Fragment, and then keys each one with `child.key || ""`. Wrapped in a
    // Fragment these two elements are therefore seen as a single child whose
    // key is the empty string, and the key props below are never read at all.
    // Modal.tsx hit the same failure and notes it there: the overlay stays
    // mounted after `open` flips to false, leaving a full-screen backdrop over
    // a page that believes nothing is open.
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-night/50"
          aria-hidden
        />
      )}

      {open && (
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
          className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-app rounded-t-3xl border-t-[2.5px] border-navy bg-biscuit dark:border-white/15 dark:bg-night-surface pb-[calc(env(safe-area-inset-bottom)+18px)]"
        >
          {/* Drag handle */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close explore menu"
            className="w-full pt-3 pb-1 flex justify-center"
          >
            <span className="block h-1.5 w-12 rounded-full bg-navy/25 dark:bg-white/25" />
          </button>

          <div className="px-4 pt-1 pb-3">
            <h2 className="text-xl font-extrabold tracking-tight text-navy dark:text-biscuit">Explore</h2>
          </div>

          {/* Six doors, each with its icon and four words or fewer. */}
          <ul className="grid grid-cols-3 gap-2.5 px-4 pb-2">
            {ITEMS.map((item) => {
              const tile =
                'relative flex h-full flex-col items-start gap-1 rounded-2xl border-[1.5px] p-3 text-left';
              const disabled = item.disabled || !flags[item.flagKey];
              if (disabled || !item.to) {
                return (
                  <li key={item.label}>
                    <div
                      aria-disabled
                      className={`${tile} cursor-not-allowed border-dashed border-navy/25 text-gray-500 dark:border-white/20 dark:text-gray-400`}
                    >
                      <BrandIcon name={item.icon} size={24} style={{ '--bean': 'currentColor' } as React.CSSProperties} />
                      <p className="mt-1 text-sm font-extrabold leading-tight">{item.label}</p>
                      <p className="text-2xs font-bold uppercase tracking-[0.08em]">Soon</p>
                    </div>
                  </li>
                );
              }
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    onClick={onClose}
                    className={`${tile} border-navy/15 bg-white text-navy transition-[transform,border-color] duration-150 ease-soft-out hover:border-navy active:translate-y-[2px] dark:border-white/10 dark:bg-night-raised dark:text-biscuit dark:hover:border-white/40`}
                  >
                    <BrandIcon name={item.icon} size={24} />
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-extrabold leading-tight">
                      {item.label}
                    </p>
                    <p className="text-xs leading-snug text-gray-600 dark:text-gray-300">{item.description}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
