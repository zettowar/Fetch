/**
 * Pet photos land softly instead of popping in line by line: pair
 * `className="photo-in"` with `ref={photoIn}` on an <img>. The photo stays
 * transparent (its tinted frame shows) until it has decoded, then fades in
 * over ~220ms. One already in the cache when the element mounts is shown at
 * once — fading a photo the viewer has just seen reads as flicker.
 *
 * A ref callback rather than a document-level load listener on purpose: the
 * listener misses a load that lands before React attaches the element, and
 * that photo would stay invisible. Here the check and the listener sit on the
 * element itself, in the same tick.
 */
export function photoIn(img: HTMLImageElement | null): void {
  if (!img || img.dataset.loaded !== undefined) return;
  if (img.complete && img.naturalWidth > 0) {
    img.dataset.loaded = 'instant';
    return;
  }
  const done = () => {
    img.dataset.loaded = '';
  };
  img.addEventListener('load', done, { once: true });
  // A broken photo still has to show its alt text.
  img.addEventListener('error', done, { once: true });
}
