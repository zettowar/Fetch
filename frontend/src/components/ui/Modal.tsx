import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Hide the close affordance for dialogs that must be resolved by a choice. */
  dismissible?: boolean;
  /** Constrains the panel. Defaults to a comfortable form width. */
  maxWidthClass?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog primitive.
 *
 * The app previously had three hand-rolled dialogs; each set `aria-modal` but
 * none moved focus into the panel, trapped Tab, restored focus on close, or
 * handled Escape — so a keyboard or screen-reader user could tab straight out
 * of the "modal" into the page behind it. This is the one implementation.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  dismissible = true,
  maxWidthClass = 'max-w-md',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  // Callers pass an inline arrow for onClose, so its identity changes on every
  // render. Reading it through a ref keeps the effect below depending only on
  // `open` — otherwise the effect tore down and re-ran continuously, which
  // dropped the Escape listener and yanked focus back on each pass.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissibleRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const all = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      // offsetParent skips hidden controls in a browser, but jsdom reports null
      // for everything — which emptied the list and turned the trap into a
      // no-op under test, so its own test could not detect a broken trap.
      // Falling back to the unfiltered list keeps behaviour identical in a
      // browser and exercisable in tests.
      const visible = all.filter((n) => n.offsetParent !== null);
      const nodes = visible.length > 0 ? visible : all;
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // Focus outside the panel entirely (the page behind, or the panel
      // container itself): pull it back in whichever direction Tab is moving.
      // Previously only the shift-Tab case handled this, so a forward Tab from
      // outside walked straight into the page the dialog was meant to block.
      if (!active || !panelRef.current.contains(active) || active === panelRef.current) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      // Wrap at both ends so focus can never leave the panel.
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown, true);

    // Keep the page behind from scrolling under the dialog.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first control once the panel has mounted.
    const raf = requestAnimationFrame(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
      target?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus?.();
    };
    // handleKeyDown is stable (empty deps), so this runs once per open/close.
  }, [open, handleKeyDown]);

  // Portalled to <body>: dialogs are opened from inside cards and list rows,
  // and any ancestor with a transform (framer-motion animates plenty of them)
  // would otherwise become the containing block for `position: fixed` and
  // trap the overlay inside that card.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          // AnimatePresence tracks exits by key; without one the overlay stays
          // mounted after `open` flips to false and the page is left covered.
          key="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onMouseDown={(e) => {
            if (dismissible && e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-soft-lg outline-none dark:bg-gray-900 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6`}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-bold tracking-tight">{title}</h2>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-1 -mt-1 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  <X size={18} aria-hidden />
                </button>
              )}
            </div>
            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
