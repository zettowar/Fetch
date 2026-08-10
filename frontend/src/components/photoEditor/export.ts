import type { EditorState } from './editorState';
import { toFilterString } from './presets';
import { loadImage } from './thumbnail';
import { applyPixelAdjustments, hasPixelAdjustments } from './pixelOps';
import {
  applyColorMatrix,
  filterStringToColorMatrix,
  isIdentityMatrix,
} from './colorMatrix';

/** Bounding box of a `w`×`h` rectangle rotated by `deg`. This is
 *  react-easy-crop's own `rotateSize` — reproduced here because the box it
 *  returns IS the coordinate space `croppedAreaPixels` is expressed in. */
export function rotatedSize(
  w: number,
  h: number,
  deg: number,
): { width: number; height: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rad) * w) + Math.abs(Math.sin(rad) * h),
    height: Math.abs(Math.sin(rad) * w) + Math.abs(Math.cos(rad) * h),
  };
}

/** Browsers cap total canvas area (Safari/iOS ≈ 16.7M px = 4096²) and silently
 *  render an over-limit canvas BLANK — which `toBlob('image/jpeg')` then
 *  flattens to solid black (JPEG has no alpha). */
const MAX_CANVAS_AREA = 16_000_000; // px²; conservative across browsers

export interface ExportGeometry {
  /** Uniform downscale keeping every buffer under `MAX_CANVAS_AREA`; 1 = no-op. */
  fit: number;
  /** Source draw size (scaled). */
  drawW: number;
  drawH: number;
  /** Rotated bounding box = the space `croppedAreaPixels` lives in (scaled). */
  bboxW: number;
  bboxH: number;
  /** Crop rect within that bounding box (scaled). */
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  rotationRad: number;
}

/**
 * Map `state.croppedAreaPixels` onto the buffers the exporter draws into.
 *
 * The one rule that matters: react-easy-crop reports the crop rect relative to
 * the top-left of the media's ROTATED BOUNDING BOX (`computeCroppedArea` →
 * `rotateSize(naturalWidth, naturalHeight, rotation)`), not the raw image and
 * not a diagonal-sized square. The intermediate canvas therefore has to be
 * exactly that bounding box, or every crop lands offset by half the difference
 * — pulling the framing off-centre and dragging empty (→ black) canvas into
 * the result even at rotation 0, where the box is just the image itself.
 *
 * Pure + exported so the geometry is unit-testable without a real canvas.
 */
export function exportGeometry(
  naturalWidth: number,
  naturalHeight: number,
  state: EditorState,
): ExportGeometry {
  const area = state.croppedAreaPixels;
  if (!area) {
    throw new Error('No crop area — wait for onCropComplete before exporting');
  }
  const totalRotDeg = state.rotation + state.straighten;

  // Scale the whole pipeline down uniformly if the bounding box would blow the
  // canvas-area cap (a full-res 4032×3024 phone photo rotated 45° needs a
  // ~5040² ≈ 25M-px box). `area` is in that same space, so it scales with it.
  const raw = rotatedSize(naturalWidth, naturalHeight, totalRotDeg);
  const fit = Math.min(1, Math.sqrt(MAX_CANVAS_AREA / (raw.width * raw.height)));

  return {
    fit,
    drawW: naturalWidth * fit,
    drawH: naturalHeight * fit,
    bboxW: raw.width * fit,
    bboxH: raw.height * fit,
    cropX: area.x * fit,
    cropY: area.y * fit,
    cropW: area.width * fit,
    cropH: area.height * fit,
    rotationRad: (totalRotDeg * Math.PI) / 180,
  };
}

/**
 * Turn the editor state + the full-resolution source into a finished JPEG
 * blob ready to POST to the server. Runs once when the user taps "Done".
 *
 * Pipeline, in order:
 *   1. Load the full-res image.
 *   2. Compose rotation (90° snaps) + straighten (−45..45°) + flips into an
 *      intermediate canvas the size of the rotated bounding box — the space
 *      `croppedAreaPixels` is measured in (see `exportGeometry`).
 *   3. Crop that rotated buffer onto the output canvas (no `ctx.filter` —
 *      Safari's canvas filter is a no-op for canvas sources, which silently
 *      dropped every filter/adjustment from saved photos).
 *   4. In one read-modify-write pass over the output buffer, bake in the
 *      color filters (preset + brightness/contrast/saturation) as a color
 *      matrix (see `colorMatrix.ts`) and the per-pixel adjustments (warmth,
 *      highlights, shadows, vignette) from `pixelOps.ts`. Warmth and tone are
 *      kept out of the color matrix so they aren't applied twice.
 *   5. Export as JPEG at 0.92 quality.
 */
export async function renderEditedBlob(
  src: string,
  state: EditorState,
): Promise<Blob> {
  const img = await loadImage(src);
  const {
    drawW,
    drawH,
    bboxW,
    bboxH,
    cropX,
    cropY,
    cropW,
    cropH,
    rotationRad,
  } = exportGeometry(img.naturalWidth, img.naturalHeight, state);

  // Intermediate canvas === the rotated bounding box, so the crop rect can be
  // used verbatim. Round the *canvas* up but keep the transform on the exact
  // (unrounded) centre — that's the origin react-easy-crop measured from.
  const rot = document.createElement('canvas');
  rot.width = Math.max(1, Math.ceil(bboxW));
  rot.height = Math.max(1, Math.ceil(bboxH));
  const rctx = rot.getContext('2d');
  if (!rctx) throw new Error('Canvas 2D unavailable');
  rctx.imageSmoothingEnabled = true;
  rctx.imageSmoothingQuality = 'high';

  rctx.translate(bboxW / 2, bboxH / 2);
  rctx.rotate(rotationRad);
  rctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  rctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

  // Output canvas sized to the (scaled) crop region. Anything the crop pulls in
  // from outside the image (rotated corners) stays transparent and flattens to
  // black on JPEG encode — matching the editor's black preview background.
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
