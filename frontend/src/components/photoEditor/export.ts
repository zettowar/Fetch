import type { EditorState } from './editorState';
import { toFilterString } from './presets';
import { loadImage } from './thumbnail';
import { applyPixelAdjustments, hasPixelAdjustments } from './pixelOps';

/**
 * Turn the editor state + the full-resolution source into a finished JPEG
 * blob ready to POST to the server. Runs once when the user taps "Done".
 *
 * Pipeline, in order:
 *   1. Load the full-res image.
 *   2. Compose rotation (90° snaps) + straighten (−45..45°) + flips into a
 *      rotated intermediate canvas that's large enough to contain any
 *      rotation (diagonal of the source).
 *   3. Crop that rotated buffer onto the output canvas, applying the CSS
 *      filter (brightness/contrast/saturation/filter preset) via
 *      `ctx.filter` — fast, GPU-assisted.
 *   4. If any pixel-pass adjustment is non-zero (warmth, highlights,
 *      shadows, vignette), read the output buffer, apply the per-pixel
 *      pass from `pixelOps.ts`, and write it back. Warmth is intentionally
 *      excluded from the CSS filter in export mode so it isn't applied
 *      twice.
 *   5. Export as JPEG at 0.92 quality (same as the old CropModal).
 */
export async function renderEditedBlob(
  src: string,
  state: EditorState,
): Promise<Blob> {
  const area = state.croppedAreaPixels;
  if (!area) {
    throw new Error('No crop area — wait for onCropComplete before exporting');
  }

  const img = await loadImage(src);
  const totalRotDeg = state.rotation + state.straighten;
  const totalRotRad = (totalRotDeg * Math.PI) / 180;

  // Intermediate canvas sized to the image's diagonal so any rotation fits.
  const safe = Math.ceil(Math.hypot(img.naturalWidth, img.naturalHeight));
  const rot = document.createElement('canvas');
  rot.width = safe;
  rot.height = safe;
  const rctx = rot.getContext('2d');
  if (!rctx) throw new Error('Canvas 2D unavailable');
  rctx.imageSmoothingEnabled = true;
  rctx.imageSmoothingQuality = 'high';

  rctx.translate(safe / 2, safe / 2);
  rctx.rotate(totalRotRad);
  rctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  rctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  // Output canvas sized to the crop region.
  const out = document.createElement('canvas');
  out.width = Math.round(area.width);
  out.height = Math.round(area.height);
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas 2D unavailable');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.filter =
    toFilterString(state.filter, state.adjustments, {
      warmthInCss: false, // real warmth happens in the pixel pass below
      approxToneInCss: false, // real tone happens in the pixel pass below
    }) || 'none';
  octx.drawImage(
    rot,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height,
  );

  // Pixel-pass adjustments — only pay the O(n) cost when something is set.
  const pixelAdj = {
    warmth: state.adjustments.warmth,
    highlights: state.adjustments.highlights,
    shadows: state.adjustments.shadows,
    vignette: state.adjustments.vignette,
  };
  if (hasPixelAdjustments(pixelAdj)) {
    // Reset filter so getImageData returns the already-filtered pixels
    // without re-applying the CSS filter on subsequent draws.
    octx.filter = 'none';
    const imgData = octx.getImageData(0, 0, out.width, out.height);
    applyPixelAdjustments(imgData, pixelAdj);
    octx.putImageData(imgData, 0, 0);
  }

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      0.92,
    );
  });
}
