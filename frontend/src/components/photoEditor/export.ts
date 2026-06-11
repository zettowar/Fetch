import type { EditorState } from './editorState';
import { toFilterString } from './presets';
import { loadImage } from './thumbnail';
import { applyPixelAdjustments, hasPixelAdjustments } from './pixelOps';
import {
  applyColorMatrix,
  filterStringToColorMatrix,
  isIdentityMatrix,
} from './colorMatrix';

/**
 * Turn the editor state + the full-resolution source into a finished JPEG
 * blob ready to POST to the server. Runs once when the user taps "Done".
 *
 * Pipeline, in order:
 *   1. Load the full-res image.
 *   2. Compose rotation (90° snaps) + straighten (−45..45°) + flips into a
 *      rotated intermediate canvas that's large enough to contain any
 *      rotation (diagonal of the source).
 *   3. Crop that rotated buffer onto the output canvas (no `ctx.filter` —
 *      Safari's canvas filter is a no-op for canvas sources, which silently
 *      dropped every filter/adjustment from saved photos).
 *   4. In one read-modify-write pass over the output buffer, bake in the
 *      color filters (preset + brightness/contrast/saturation) as a color
 *      matrix (see `colorMatrix.ts`) and the per-pixel adjustments (warmth,
 *      highlights, shadows, vignette) from `pixelOps.ts`. Warmth and tone are
 *      kept out of the color matrix so they aren't applied twice.
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

  // The rotation buffer below is sized to the source's diagonal SQUARED.
  // Browsers cap total canvas area (Safari/iOS ≈ 16.7M px = 4096²) and
  // silently render an over-limit canvas BLANK — which toBlob('image/jpeg')
  // then flattens to solid black (JPEG has no alpha). A full-res phone photo
  // (4032×3024 → a 5040² ≈ 25M-px buffer) trips this. Scale the whole
  // pipeline down uniformly so the buffer stays under the limit; `area` is in
  // the same coordinate space as `img`, so it scales by the same factor.
  // `fit` is 1 (a no-op) for anything already small enough.
  const MAX_CANVAS_AREA = 16_000_000; // px²; conservative across browsers
  const rawDiag = Math.hypot(img.naturalWidth, img.naturalHeight);
  const fit = Math.min(1, Math.sqrt(MAX_CANVAS_AREA) / rawDiag);
  const drawW = img.naturalWidth * fit;
  const drawH = img.naturalHeight * fit;

  // Intermediate canvas sized to the (scaled) image's diagonal so any
  // rotation fits without clipping the corners.
  const safe = Math.ceil(Math.hypot(drawW, drawH));
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
  rctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

  // Crop rectangle, scaled into the same space as the rotation buffer.
  const cropX = area.x * fit;
  const cropY = area.y * fit;
  const cropW = area.width * fit;
  const cropH = area.height * fit;

  // Output canvas sized to the (scaled) crop region.
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cropW));
  out.height = Math.max(1, Math.round(cropH));
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas 2D unavailable');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  // No octx.filter here on purpose — color filters are baked in by the matrix
  // pass below so the result is identical across browsers (see colorMatrix.ts).
  octx.drawImage(
    rot,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    out.width,
    out.height,
  );

  // Single read-modify-write pass: color filters first (preset +
  // brightness/contrast/saturation, as a color matrix), then the per-pixel
  // adjustments (warmth/highlights/shadows/vignette). Warmth and tone are
  // excluded from the matrix string so they aren't applied twice. Skip the
  // O(n) loop entirely when nothing is set.
  const colorMatrix = filterStringToColorMatrix(
    toFilterString(state.filter, state.adjustments, {
      warmthInCss: false,
      approxToneInCss: false,
    }),
  );
  const needsColor = !isIdentityMatrix(colorMatrix);
  const pixelAdj = {
    warmth: state.adjustments.warmth,
    highlights: state.adjustments.highlights,
    shadows: state.adjustments.shadows,
    vignette: state.adjustments.vignette,
  };
  if (needsColor || hasPixelAdjustments(pixelAdj)) {
    const imgData = octx.getImageData(0, 0, out.width, out.height);
    if (needsColor) applyColorMatrix(imgData, colorMatrix);
    if (hasPixelAdjustments(pixelAdj)) applyPixelAdjustments(imgData, pixelAdj);
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
