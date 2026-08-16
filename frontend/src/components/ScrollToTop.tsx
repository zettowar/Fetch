import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets scroll on route change — except when the URL carries a hash, where the
 * caller asked for a specific section instead.
 *
 * The hash branch is not decoration. On a full page load the browser tries to
 * jump to the anchor before React has rendered anything, finds nothing, and
 * gives up; an unconditional scrollTo(0, 0) here then buries the intent for
 * good. That made every anchored section of the legal pages impossible to link
 * to from outside the app, which is most of the point of anchoring them.
 *
 * In-page clicks (`<a href="#foo">`) never reach this component — the browser
 * handles those natively — so this only covers arriving with a hash already set.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (typeof window.scrollTo !== 'function') return;

    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    // The target may be a frame or two behind us on first paint (lazy routes,
    // suspense boundaries), so retry briefly before falling back to the top.
    let frames = 0;
    let raf = 0;
    const seek = () => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        el.scrollIntoView();
        return;
      }
      if (frames++ < 10) {
        raf = requestAnimationFrame(seek);
      } else {
        window.scrollTo(0, 0);
      }
    };
    raf = requestAnimationFrame(seek);
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash]);

  return null;
}
