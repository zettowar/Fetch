/**
 * Pixel-pass adjustments that CSS filters can't faithfully express.
 *
 * The CSS pipeline (see presets.ts) handles brightness/contrast/saturation
 * and the preset filters with GPU-accelerated precision. Everything here
 * runs only at export time, as a single pass over the cropped output
 * canvas, and is skipped if the relevant sliders are all zero.
 *
 * Conventions: all adjustments live on a -100..100 scale.
 *   - warmth > 0  → image is warmer (R up, B down)
 *   - vignette > 0 → corners darker; <=0 is a no-op
 *   - highlights > 0 → bright pixels pulled down (recover blown sky)
 *   - shadows   > 0 → dark pixels lifted (recover crushed shadows)
 */

export interface PixelAdjustments {
  warmth: number;
  vignette: number;
  highlights: number;
  shadows: number;
}

/** True iff any pixel-pass adjustment is non-zero. Callers can skip the
 *  per-pixel loop entirely when this returns false. */
export function hasPixelAdjustments(a: PixelAdjustments): boolean {
  return a.warmth !== 0 || a.vignette !== 0 || a.highlights !== 0 || a.shadows !== 0;
}

/**
 * Apply all four pixel adjustments in a single pass (mutates in place for
 * speed; the same buffer is returned for chaining convenience).
 *
 * ~30ms on a 1280×720 buffer on a mid-range phone — acceptable for export.
 */
export function applyPixelAdjustments(
  imageData: ImageData,
  adj: PixelAdjustments,
): ImageData {
  const { data, width, height } = imageData;

  // --- Precompute scalars ----------------------------------------------
  const warmth = adj.warmth / 100;              // -1..1
  const warmR = 1 + warmth * 0.4;               // ≤ +40% R on max warm
  const warmB = 1 - warmth * 0.4;               // ≤ -40% B on max warm
  const warmthOn = warmth !== 0;

  const highlights = adj.highlights / 100;      // -1..1
  const shadows = adj.shadows / 100;            // -1..1
  const toneOn = highlights !== 0 || shadows !== 0;
  // Hue-agnostic luminance weights (Rec. 601 — plenty for photo UIs).
  const R_W = 0.299;
  const G_W = 0.587;
  const B_W = 0.114;

  const vignette = Math.max(0, adj.vignette) / 100; // 0..1; negative ignored
  const vignetteOn = vignette > 0;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.hypot(cx, cy);
  // Darkening starts at ~55% of the radius and grows quadratically outward.
  const VIG_INNER = 0.55;
  const VIG_STRENGTH = 0.85;

  // --- Main loop -------------------------------------------------------
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 1. True per-channel warmth (R *= gain, B /= gain).
      if (warmthOn) {
        r = clamp(r * warmR, 0, 255);
        b = clamp(b * warmB, 0, 255);
      }

      // 2. Tone: luma-weighted highlights/shadows lift/crush.
      if (toneOn) {
        const luma = (R_W * r + G_W * g + B_W * b) / 255; // 0..1
        // Weights isolate each region with a smooth falloff around midtone.
        const shadowW = smoothstep(0.0, 0.5, 0.5 - luma); // peaks in shadows
        const highlightW = smoothstep(0.0, 0.5, luma - 0.5); // peaks in highlights
        // Positive shadows = lift (+delta); positive highlights = pull down (-delta).
        const delta = shadows * shadowW * 48 - highlights * highlightW * 48;
        if (delta !== 0) {
          r = clamp(r + delta, 0, 255);
          g = clamp(g + delta, 0, 255);
          b = clamp(b + delta, 0, 255);
        }
      }

      // 3. Vignette: radial darken from corners inward.
      if (vignetteOn) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy) / maxDist; // 0..1
        if (d > VIG_INNER) {
          const t = (d - VIG_INNER) / (1 - VIG_INNER); // 0..1 across falloff
          const darken = 1 - vignette * VIG_STRENGTH * t * t;
          r *= darken;
          g *= darken;
          b *= darken;
        }
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
  return imageData;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Classic smoothstep between edge0 and edge1. Returns 0..1. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
