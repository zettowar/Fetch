import { totalRotation, frameOf, type EditorState } from './editorState';
import type { Point, Size } from './coverage';
import { toFilterString } from './presets';
import { applyPixelAdjustments, hasPixelAdjustments } from './pixelOps';
import {
  applyColorMatrix,
  filterStringToColorMatrix,
  isIdentityMatrix,
} from './colorMatrix';

/** Saved photos are at most this many px on a side (the server's cap too). */
export const MAX_OUTPUT_EDGE = 1600;

/**
 * How to draw the saved photo: the preview's own transform, at one scale.
 *
 * The editor shows the photo as `translate(offset) rotate(θ) scale(zoom)
 * flip` about its centre, under a square frame centred in the container.
 * The export draws exactly that, onto a canvas the size of the frame, with
 * every display length multiplied by `k` (output px per display px). There
 * is no crop rectangle to reconstruct and no intermediate canvas — which is
 * where the old exporter went wrong (its crops landed offset and dragged
 * empty canvas, flattened to black bands, into saved photos).
 *
 * `k` is chosen so that at zoom 1 one photo pixel becomes one output pixel,
 * then capped at MAX_OUTPUT_EDGE. `overscan` enlarges the draw a hair about
 * the centre: when the frame sits exactly on the photo's edge, that edge's
 * antialiasing would otherwise blend with empty canvas into a dark seam.
 */
export interface ExportPlan {
  outW: number;
  outH: number;
  /** Photo-centre offset from the output centre, output px (pre-overscan). */
  offset: Point;
  rotationRad: number;
  flipX: 1 | -1;
  flipY: 1 | -1;
  /** Output px per source px (pre-overscan). */
  scale: number;
  overscan: number;
  source: Size;
}

export function exportPlan(state: EditorState, source: Size, maxEdge = MAX_OUTPUT_EDGE): ExportPlan {
  const frame = frameOf(state);
  const media = state.geometry?.media;
  if (!frame || !media || frame.width <= 0 || media.width <= 0) {
    throw new Error('The editor hasn’t measured the photo yet');
  }
  const displayPerSource = media.width / source.width;
  // 1 source px → 1 output px at zoom 1, unless that would exceed the cap.
  let k = 1 / (state.zoom * displayPerSource);
  const longest = Math.max(frame.width, frame.height) * k;
  if (longest > maxEdge) k *= maxEdge / longest;
  const outW = Math.max(1, Math.round(frame.width * k));
  const outH = Math.max(1, Math.round(frame.height * k));
  // Re-derive the scale from the rounded canvas, so the canvas is the frame
  // exactly — rounding up half a pixel would otherwise reach past the frame,
  // and past the photo when the frame sits on its edge.
  k = outW / frame.width;
  return {
    outW,
    outH,
    offset: { x: state.crop.x * k, y: state.crop.y * k },
    rotationRad: (totalRotation(state) * Math.PI) / 180,
    flipX: state.flipH ? -1 : 1,
    flipY: state.flipV ? -1 : 1,
    scale: state.zoom * k * displayPerSource,
    overscan: 1 + 2 / Math.min(outW, outH),
    source,
  };
}

/** Where an output pixel samples the source photo (source px, origin top-left). */
export function outputToSource(plan: ExportPlan, ox: number, oy: number): Point {
  // Undo, in reverse: centre + overscan, offset, rotation, flip, scale.
  let x = (ox - plan.outW / 2) / plan.overscan - plan.offset.x;
  let y = (oy - plan.outH / 2) / plan.overscan - plan.offset.y;
  const c = Math.cos(-plan.rotationRad);
  const s = Math.sin(-plan.rotationRad);
  [x, y] = [c * x - s * y, s * x + c * y];
  x = (x * plan.flipX) / plan.scale + plan.source.width / 2;
  y = (y * plan.flipY) / plan.scale + plan.source.height / 2;
  return { x, y };
}

/** True when all four output corners sample inside the source photo. */
export function planCovered(plan: ExportPlan, eps = 1e-6): boolean {
  return [
    [0, 0],
    [plan.outW, 0],
    [plan.outW, plan.outH],
    [0, plan.outH],
  ].every(([ox, oy]) => {
    const p = outputToSource(plan, ox, oy);
    return p.x >= -eps && p.y >= -eps && p.x <= plan.source.width + eps && p.y <= plan.source.height + eps;
  });
}

function draw(ctx: CanvasRenderingContext2D, source: CanvasImageSource, plan: ExportPlan) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, plan.outW, plan.outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(plan.outW / 2, plan.outH / 2);
  ctx.scale(plan.overscan, plan.overscan);
  ctx.translate(plan.offset.x, plan.offset.y);
  ctx.rotate(plan.rotationRad);
  ctx.scale(plan.flipX * plan.scale, plan.flipY * plan.scale);
  ctx.drawImage(source, -plan.source.width / 2, -plan.source.height / 2, plan.source.width, plan.source.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Every pixel on the four edges fully opaque — the photo covers the canvas. */
function edgesOpaque(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const strips = [
    ctx.getImageData(0, 0, w, 1),
    ctx.getImageData(0, h - 1, w, 1),
    ctx.getImageData(0, 0, 1, h),
    ctx.getImageData(w - 1, 0, 1, h),
  ];
  for (const { data } of strips) {
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return false;
  }
  return true;
}

/**
 * Turn the editor state and its working image into the JPEG that gets
 * uploaded. `source` must be the very image the cropper displayed (same
 * pixels, same size) — the editor hands over its working canvas.
 *
 * The frame can't leave the photo (coverage.ts keeps it on), and two checks
 * here make sure of it anyway: the plan's corners are tested mathematically,
 * then the drawn edges are tested pixel by pixel. If either finds daylight,
 * the draw is nudged in and retried; if that still fails the export throws,
 * because uploading a photo with a black edge is worse than asking the person
 * to try again.
 */
export async function renderEditedBlob(
  source: HTMLCanvasElement,
  state: EditorState,
): Promise<Blob> {
  const plan = exportPlan(state, { width: source.width, height: source.height });
  for (let i = 0; i < 40 && !planCovered(plan); i++) plan.overscan *= 1.002;

  const out = document.createElement('canvas');
  out.width = plan.outW;
  out.height = plan.outH;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D unavailable');

  draw(ctx, source, plan);
  for (let i = 0; i < 6 && !edgesOpaque(ctx, plan.outW, plan.outH); i++) {
    plan.overscan *= 1.004;
    draw(ctx, source, plan);
  }
  if (!edgesOpaque(ctx, plan.outW, plan.outH)) {
    throw new Error('Couldn’t frame that photo cleanly. Zoom in a little and try again.');
  }

  // One read-modify-write pass for the look: colour filters (preset +
  // brightness/contrast/saturation) as a colour matrix, then the per-pixel
  // adjustments. No ctx.filter: Safari ignores it for canvas sources, which
  // once silently dropped every filter from saved photos.
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
    const imgData = ctx.getImageData(0, 0, plan.outW, plan.outH);
    if (needsColor) applyColorMatrix(imgData, colorMatrix);
    if (hasPixelAdjustments(pixelAdj)) applyPixelAdjustments(imgData, pixelAdj);
    ctx.putImageData(imgData, 0, 0);
  }

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Couldn’t save that photo. Try again.'))),
      'image/jpeg',
      0.92,
    );
  });
}
