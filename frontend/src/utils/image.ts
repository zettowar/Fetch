import { downscaleToCanvas, loadImage } from '../components/photoEditor/thumbnail';

/**
 * Client-side normalization for uploads that go straight to the server without
 * passing through PhotoEditor (which already re-encodes as it exports).
 *
 * Every upload endpoint accepts JPEG/PNG/WebP only and caps at 10MB, but the
 * picker now uses `accept="image/*"` — that's what makes Android offer the
 * camera at all — so it can hand back a 12MP HEIC. Re-encoding here means the
 * user gets a photo instead of a server-side "unsupported format".
 */

/** Server-side MAX_DIMENSION; no point uploading more pixels than are kept. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.9;

export class UnreadableImageError extends Error {
  constructor() {
    super("Couldn't read that photo — try a JPEG, PNG, or WebP.");
    this.name = 'UnreadableImageError';
  }
}

/** True if the browser can actually decode this file. */
export async function canDecodeImage(objectUrl: string): Promise<boolean> {
  try {
    await loadImage(objectUrl);
    return true;
  } catch {
    return false;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new UnreadableImageError())),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/**
 * Decode any browser-readable image and re-encode it as a bounded JPEG.
 * Throws UnreadableImageError when the format is one the browser can't open
 * (HEIC on most Android builds).
 */
export async function normalizeImageFile(file: File, maxEdge = MAX_EDGE): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url).catch(() => {
      throw new UnreadableImageError();
    });
    const canvas = downscaleToCanvas(img, maxEdge);
    const blob = await canvasToBlob(canvas);
    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
