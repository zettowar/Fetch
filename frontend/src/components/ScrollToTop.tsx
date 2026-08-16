import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets scroll on route change — except when the URL carries a hash, where the
 * caller asked for a specific section instead.
 *
 * Two things make the hash branch harder than it looks, and both were found by
 * measuring rather than reasoning:
 *
 *  1. On a cold load the browser tries the anchor before React has rendered
 *     anything, finds nothing, and gives up. An unconditional scrollTo(0, 0)
 *     here then buries the intent for good, which made every anchored clause
 *     on the legal pages impossible to link to from outside the app.
 *  2. Scrolling as soon as the element exists is still not enough. Inter is
 *     loaded from Google Fonts with `display=swap`, so first paint uses a
 *     fallback and the whole document reflows when the real font lands. On the
 *     Terms page that moved the target ~3000px *after* we had already scrolled
 *     to it, landing the reader in the middle of an unrelated clause.
 *
 * So rather than scrolling once, we re-assert until the target's document
 * offset holds still, and start over once the webfont settles. The loop yields
 * immediately if the reader starts scrolling — a deep link is a suggestion, not
 * a claim on the viewport.
 *
 * In-page clicks (`<a href="#foo">`) never reach this component — the browser
 * handles those natively — so this only covers arriving with a hash already set.
 */

/** Frames the target must hold position before we call it settled. */
const STABLE_FRAMES = 3;
/** Upper bound on the settle loop (~2s at 60fps) so a churning page can't pin it. */
const MAX_FRAMES = 120;
/** Frames to wait for a target that isn't in the DOM yet before giving up. */
const MISSING_TARGET_FRAMES = 10;

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (typeof window.scrollTo !== 'function') return;

    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    const id = decodeURIComponent(hash.slice(1));
    let cancelled = false;
    let raf = 0;
    let frames = 0;
    let lastOffset = NaN;
    let stable = 0;

    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };

    const settle = () => {
      if (cancelled) return;
      frames += 1;

      const el = document.getElementById(id);
      if (!el) {
        if (frames < MISSING_TARGET_FRAMES) raf = requestAnimationFrame(settle);
        else window.scrollTo(0, 0);
        return;
      }

      const offset = el.getBoundingClientRect().top + window.scrollY;
      if (offset === lastOffset) {
        stable += 1;
      } else {
        stable = 0;
        lastOffset = offset;
        el.scrollIntoView();
      }

      if (stable < STABLE_FRAMES && frames < MAX_FRAMES) {
        raf = requestAnimationFrame(settle);
      }
    };

    const restart = () => {
      if (cancelled) return;
      cancelAnimationFrame(raf);
      frames = 0;
      lastOffset = NaN;
      stable = 0;
      raf = requestAnimationFrame(settle);
    };

    restart();
    // The webfont swap reflows the document long after first paint.
    document.fonts?.ready.then(restart);

    // Never fight the reader for the scrollbar.
    const opts = { passive: true, once: true } as const;
    window.addEventListener('wheel', stop, opts);
    window.addEventListener('touchstart', stop, opts);
    window.addEventListener('keydown', stop, opts);

    return () => {
      stop();
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [pathname, hash]);

  return null;
}
