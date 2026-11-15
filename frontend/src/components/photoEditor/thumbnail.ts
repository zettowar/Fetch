/**
 * Image helpers used by PhotoEditor for:
 *   - the working image (upright, capped, shown and exported alike)
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
      reject(new Error("Couldn't open that image.")),
    );
    img.src = src;
  });
}

/** Downscale (preserving aspect) into a canvas with `maxEdge` on the long side. */
export function downscaleToCanvas(
  img: HTMLImageElement,
  maxEdge: number,
  /** Paint this under the image first — flattens transparency. */
  background?: string,
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
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/** The photo the editor works on — see `prepareWorkingImage`. */
export interface WorkingImage {
  /** Object URL the cropper displays. Revoke when done. */
  url: string;
  /** The same pixels, for the exporter to draw from. */
  canvas: HTMLCanvasElement;
}

/**
 * Normalise a picked photo into the one image the editor shows AND exports.
 *
 * Always re-drawn through a canvas, even when it's already small: drawing
 * applies the file's EXIF orientation, so a phone photo that is stored
 * sideways with a "rotate me" tag comes out as upright pixels with no tag.
 * From here on there is no orientation to disagree about — the cropper's
 * <img> and the exporter's canvas hold the same upright pixels at the same
 * size. (The editor used to show a downscaled copy that replaced the
 * original mid-session, so a crop could be measured on one image and cut
 * from the other.)
 *
 * `maxEdge` caps the long side; saved photos are capped at the same size.
 */
export async function prepareWorkingImage(src: string, maxEdge = 1600): Promise<WorkingImage> {
  const img = await loadImage(src);
  if (!img.naturalWidth || !img.naturalHeight) throw new Error("Couldn't open that image.");
  // White under the photo: a transparent PNG would otherwise go black in the
  // JPEG it becomes (the server flattens onto white for the same reason).
  const canvas = downscaleToCanvas(img, maxEdge, '#FFFFFF');
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
  if (!blob) throw new Error("Couldn't open that image.");
  return { url: URL.createObjectURL(blob), canvas };
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
