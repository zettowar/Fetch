/**
 * Keep the crop frame on the photo.
 *
 * The cropper (react-easy-crop) only keeps the frame inside the photo's
 * rotated BOUNDING BOX. At 0/90/180/270° that box is the photo, but once the
 * photo is straightened by a few degrees the box has empty corners, and the
 * frame was free to capture them — which JPEG flattens to black triangles.
 * This module is the stricter rule: every point of the frame lies on the photo.
 *
 * Coordinates are the cropper's display pixels:
 *  - `frame` is the crop frame, centred in the container;
 *  - `media` is the photo's size on screen at zoom 1, before rotation;
 *  - `offset` is the photo centre relative to the frame centre (the cropper's
 *    `crop` value), and the photo is drawn `translate(offset) rotate(θ)
 *    scale(zoom)` about its own centre (flips don't change what it covers).
 *
 * The geometry is kind: in the photo's own (rotated) axes, the set of offsets
 * that keep the frame covered is a plain rectangle. So the minimum zoom has a
 * closed form, and keeping an offset legal is "rotate into the photo's axes,
 * clamp each coordinate, rotate back" — which is also the nearest legal
 * offset, so a drag past an edge slides along it rather than sticking.
 */

export interface Size {
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}

function trig(deg: number) {
  const r = (deg * Math.PI) / 180;
  // Snap the quarter turns exactly, so 90° doesn't leave a 6e-17 sliver.
  const round = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
  return { c: round(Math.cos(r)), s: round(Math.sin(r)) };
}

/**
 * Half-extents of the frame measured along the photo's axes: how far the
 * frame reaches across the photo's width (`x`) and height (`y`).
 */
function frameReach(frame: Size, deg: number): Point {
  const { c, s } = trig(deg);
  const hw = frame.width / 2;
  const hh = frame.height / 2;
  return {
    x: Math.abs(c) * hw + Math.abs(s) * hh,
    y: Math.abs(s) * hw + Math.abs(c) * hh,
  };
}

/**
 * The least zoom at which the photo covers the frame (with the photo
 * centred), never below 1. At quarter turns this is 1, because the frame is
 * sized to fit the photo; straightening raises it.
 */
export function minZoomToCover(frame: Size, media: Size, deg: number): number {
  if (media.width <= 0 || media.height <= 0) return 1;
  const reach = frameReach(frame, deg);
  return Math.max(1, (2 * reach.x) / media.width, (2 * reach.y) / media.height);
}

/** The nearest offset at which the frame stays entirely on the photo. */
export function clampOffset(
  offset: Point,
  frame: Size,
  media: Size,
  zoom: number,
  deg: number,
): Point {
  const { c, s } = trig(deg);
  const reach = frameReach(frame, deg);
  const limX = Math.max(0, (zoom * media.width) / 2 - reach.x);
  const limY = Math.max(0, (zoom * media.height) / 2 - reach.y);
  // Into the photo's axes (rotate by −θ), clamp, and back (rotate by θ).
  const u0 = c * offset.x + s * offset.y;
  const v0 = -s * offset.x + c * offset.y;
  // Already legal: hand it back untouched, not via a lossy round trip.
  if (Math.abs(u0) <= limX && Math.abs(v0) <= limY) return offset;
  const u = Math.min(limX, Math.max(-limX, u0));
  const v = Math.min(limY, Math.max(-limY, v0));
  const x = c * u - s * v;
  const y = s * u + c * v;
  // Keep -0 out of state; it compares unequal in snapshots and tests.
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

/**
 * Where a frame corner lands in the photo's own coordinates (photo pixels at
 * zoom 1, origin at the photo centre). Exposed for tests and the exporter's
 * last-line coverage check.
 */
export function frameCornersOnMedia(
  offset: Point,
  frame: Size,
  zoom: number,
  deg: number,
): Point[] {
  const { c, s } = trig(deg);
  const hw = frame.width / 2;
  const hh = frame.height / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([fx, fy]) => {
    const qx = fx - offset.x;
    const qy = fy - offset.y;
    return { x: (c * qx + s * qy) / zoom, y: (-s * qx + c * qy) / zoom };
  });
}

/** True when the whole frame lies on the photo (within `eps` display px). */
export function frameCovered(
  offset: Point,
  frame: Size,
  media: Size,
  zoom: number,
  deg: number,
  eps = 1e-6,
): boolean {
  return frameCornersOnMedia(offset, frame, zoom, deg).every(
    (p) => Math.abs(p.x) <= media.width / 2 + eps && Math.abs(p.y) <= media.height / 2 + eps,
  );
}

/**
 * The crop frame for a photo shown `media`-sized in a `container`, turned by
 * a quarter-turn `rotation`: the largest square that fits both. Straighten is
 * deliberately left out, so the frame holds still while the photo zooms in
 * underneath it (the cropper would otherwise grow the frame to the rotated
 * bounding box — the very box that has empty corners).
 */
export function squareFrame(media: Size, container: Size, rotation: number): Size {
  const quarter = ((Math.round(rotation / 90) % 4) + 4) % 4;
  const swap = quarter % 2 === 1;
  const w = Math.min(swap ? media.height : media.width, container.width);
  const h = Math.min(swap ? media.width : media.height, container.height);
  const side = Math.max(0, Math.min(w, h));
  return { width: side, height: side };
}
