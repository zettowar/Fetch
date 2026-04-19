/**
 * Image-downscale helpers used by PhotoEditor for:
 *   - a preview-res copy of the source (fast crop/filter manipulation)
 *   - filter-strip thumbnails (one per preset)
 *
 * We never send these back to the server — they're purely for the editor UI.
 */

/** Load a URL into an HTMLImageElement. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Same-origin by default. crossOrigin is unnecessary for object URLs.
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () =>
      reject(new Error('Failed to load image')),
    );
    img.src = src;
  });
}

/** Downscale (preserving aspect) into a canvas with `maxEdge` on the long side. */
export function downscaleToCanvas(
  img: HTMLImageElement,
  maxEdge: number,
): HTMLCanvasElement {
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  // imageSmoothingQuality is hinted here but not strictly required.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * Build a preview data URL for the main Cropper. We cap at 1280px on the
 * long edge so filter previews and pan/zoom feel instant on phones.
 */
export async function buildPreviewUrl(
  src: string,
  maxEdge = 1280,
): Promise<string> {
  const img = await loadImage(src);
  if (Math.max(img.naturalWidth, img.naturalHeight) <= maxEdge) {
    return src; // already small enough, no need to copy
  }
  const canvas = downscaleToCanvas(img, maxEdge);
  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Produce a small square center-crop of the source (used as the base image
 * for each filter-preset thumbnail). Runs once per editor session.
 */
export async function buildThumbnailBase(
  src: string,
  size = 96,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(src);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

/**
 * Render `base` through a CSS filter and return a data URL. Caller handles
 * caching per filter preset.
 */
export function applyCssFilterToCanvas(
  base: HTMLCanvasElement,
  cssFilter: string,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.filter = cssFilter || 'none';
  ctx.drawImage(base, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}
