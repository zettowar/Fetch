import { useEffect, useRef } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePublicFlags } from '../hooks/usePublicFlags';
import { TABLET_UP, useMediaQuery } from '../hooks/useMediaQuery';
import BrandIcon from './brand/BrandIcon';
import Peek from './brand/Peek';
import { EXPLORE_ITEMS as ITEMS } from './nav/navConfig';

const FOCUSABLE = 'a[href], button:not([disabled])';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The viewer's species preference: a cat person gets a cat peeking in. */
  species?: string | null;
}

// On a phone: a bottom-anchored sheet that slides up from above the tab bar.
// Mirrors the pattern in native iOS/Android share sheets — drag/tap the handle
// to close, tap the backdrop to dismiss, Esc to close on keyboards.
//
// From `sm` up (opened from the tablet rail) it is a centred dialog instead: a
// sheet glued to the bottom of a 1000px-wide window, 400px from the button
// that opened it, reads as a bug. No drag there — nobody flicks a dialog away
// with a mouse. The desktop sidebar lists these doors itself and never opens
// this at all.
export default function ExploreSheet({ open, onClose, species }: Props) {
  const flags = usePublicFlags();
  const asDialog = useMediaQuery(TABLET_UP);
  const panelRef = useRef<HTMLDivElement>(null);
  // The shell passes an inline arrow, so onClose changes identity on every
  // render. Read through a ref, the effect below runs once per open/close —
  // otherwise each re-render would restore focus to the opener and pull it
  // straight back in (Modal.tsx hit the same thing).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // aria-modal is a promise: focus moves in, Tab can't wander into the page
  // behind, and closing hands focus back to whatever opened it. The same
  // contract as Modal.tsx — this sheet predates it and kept only the Escape.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = focusables();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !panelRef.current?.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // Prevent the page behind the sheet from scrolling while it's open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Into the panel once it has mounted: the close control comes first.
    const raf = requestAnimationFrame(() => focusables()[0]?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Navigating away closes the sheet too; then the opener may be gone.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

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
          // Above the help button (FeedbackWidget, z-50), which otherwise
          // floats over the sheet's last row.
          className="fixed inset-0 z-[51] bg-night/50"
          aria-hidden
        />
      )}

      {open && (
        <motion.div
          key="sheet"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Explore"
          {...(asDialog
            ? {
                initial: { opacity: 0, scale: 0.96, y: 12 },
                animate: { opacity: 1, scale: 1, y: 0 },
                exit: { opacity: 0, scale: 0.96, y: 12 },
                transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
              }
            : {
                initial: { y: '100%' },
                animate: { y: 0 },
                exit: { y: '100%' },
                transition: { type: 'spring', stiffness: 360, damping: 32 },
                drag: 'y' as const,
                dragConstraints: { top: 0, bottom: 0 },
                dragElastic: { top: 0, bottom: 0.4 },
                onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
                  if (info.offset.y > 100 || info.velocity.y > 600) onClose();
                },
              })}
          // Centered with mx-auto (and my-auto as a dialog), not
          // left-1/2 -translate-x-1/2: framer-motion owns this element's
          // inline transform for the slide-up, which would clobber a
          // class-based translate and shove the sheet half offscreen.
          className={
            asDialog
              ? 'fixed inset-x-0 top-0 bottom-0 z-[52] m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-3xl border-[2.5px] border-navy bg-biscuit pb-5 shadow-toy dark:border-white/15 dark:bg-night-surface'
              : 'fixed inset-x-0 bottom-0 z-[52] mx-auto w-full max-w-app rounded-t-3xl border-t-[2.5px] border-navy bg-biscuit dark:border-white/15 dark:bg-night-surface pb-[calc(env(safe-area-inset-bottom)+18px)]'
          }
        >
          {/* Somebody's always curious what's in here. */}
          <Peek id={species === 'cat' ? 'ginger' : 'corgi'} className="right-9 h-14" />
          {asDialog ? (
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <h2 className="font-display text-[28px] leading-none text-navy dark:text-biscuit">Explore</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close explore menu"
                className="btn-icon h-9 w-9"
              >
                <BrandIcon name="close" size={18} />
              </button>
            </div>
          ) : (
            <>
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
                <h2 className="font-display text-[28px] leading-none text-navy dark:text-biscuit">Explore</h2>
              </div>
            </>
          )}

          {/* Six doors, each with its icon and four words or fewer. */}
          <ul className={`grid grid-cols-3 gap-2.5 pb-2 ${asDialog ? 'px-5' : 'px-4'}`}>
            {ITEMS.map((item) => {
              const tile =
                'relative flex h-full flex-col items-start gap-1 rounded-2xl border-[1.5px] p-3 text-left';
              const disabled = !flags[item.flagKey];
              if (disabled) {
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
