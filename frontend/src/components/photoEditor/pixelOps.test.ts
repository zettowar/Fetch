import { describe, expect, it } from 'vitest';
import {
  applyPixelAdjustments,
  hasPixelAdjustments,
} from './pixelOps';

/**
 * Build an ImageData-shaped stub with a flat RGB fill. jsdom doesn't ship
 * the `ImageData` constructor, and `applyPixelAdjustments` only reads
 * `data`, `width`, `height`, so a plain object with the same shape is
 * enough for these tests.
 */
function flat(w: number, h: number, r: number, g: number, b: number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4 + 0] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h, colorSpace: 'srgb' } as unknown as ImageData;
}

describe('hasPixelAdjustments', () => {
  it('returns false for the zero vector', () => {
    expect(
      hasPixelAdjustments({ warmth: 0, vignette: 0, highlights: 0, shadows: 0 }),
    ).toBe(false);
  });

  it('returns true if any channel is non-zero', () => {
    expect(
      hasPixelAdjustments({ warmth: 0, vignette: 0, highlights: 0, shadows: 5 }),
    ).toBe(true);
    expect(
      hasPixelAdjustments({ warmth: 0, vignette: 1, highlights: 0, shadows: 0 }),
    ).toBe(true);
  });
});

describe('applyPixelAdjustments', () => {
  it('leaves pixels untouched when all channels are zero', () => {
    const img = flat(4, 4, 128, 64, 200);
    const before = new Uint8ClampedArray(img.data);
    applyPixelAdjustments(img, {
      warmth: 0,
      vignette: 0,
      highlights: 0,
      shadows: 0,
    });
    expect(Array.from(img.data)).toEqual(Array.from(before));
  });

  it('positive warmth pushes R up and B down', () => {
    const img = flat(2, 2, 100, 100, 100);
    applyPixelAdjustments(img, {
      warmth: 100,
      vignette: 0,
      highlights: 0,
      shadows: 0,
    });
    // R *= 1.4, B *= 0.6 (see pixelOps.ts)
    expect(img.data[0]).toBeGreaterThan(100);
    expect(img.data[2]).toBeLessThan(100);
    expect(img.data[1]).toBe(100); // green untouched by warmth
  });

  it('positive shadows lifts a dark pixel, leaves a bright one mostly alone', () => {
    const dark = flat(1, 1, 30, 30, 30);
    const bright = flat(1, 1, 220, 220, 220);
    applyPixelAdjustments(dark, {
      warmth: 0,
      vignette: 0,
      highlights: 0,
      shadows: 100,
    });
    applyPixelAdjustments(bright, {
      warmth: 0,
      vignette: 0,
      highlights: 0,
      shadows: 100,
    });
    expect(dark.data[0]).toBeGreaterThan(30); // lifted
    // bright pixel gets little to no shadow lift
    expect(Math.abs(bright.data[0] - 220)).toBeLessThan(5);
  });

  it('positive highlights pulls a bright pixel down, leaves a dark one mostly alone', () => {
    const bright = flat(1, 1, 240, 240, 240);
    const dark = flat(1, 1, 20, 20, 20);
    applyPixelAdjustments(bright, {
      warmth: 0,
      vignette: 0,
      highlights: 100,
      shadows: 0,
    });
    applyPixelAdjustments(dark, {
      warmth: 0,
      vignette: 0,
      highlights: 100,
      shadows: 0,
    });
    expect(bright.data[0]).toBeLessThan(240);
    expect(Math.abs(dark.data[0] - 20)).toBeLessThan(5);
  });

  it('vignette darkens corners more than the center', () => {
    const img = flat(20, 20, 200, 200, 200);
    applyPixelAdjustments(img, {
      warmth: 0,
      vignette: 100,
      highlights: 0,
      shadows: 0,
    });
    // Center pixel (10,10) should be near the original; corner (0,0) should be darker.
    const center = img.data[(10 * 20 + 10) * 4];
    const corner = img.data[0];
    expect(center).toBeGreaterThan(corner);
    // Center inside the inner radius should be completely unaffected.
    expect(center).toBe(200);
    expect(corner).toBeLessThan(200);
  });

  it('ignores negative vignette (no-op, not a brightening)', () => {
    const img = flat(8, 8, 120, 120, 120);
    const before = new Uint8ClampedArray(img.data);
    applyPixelAdjustments(img, {
      warmth: 0,
      vignette: -50,
      highlights: 0,
      shadows: 0,
    });
    expect(Array.from(img.data)).toEqual(Array.from(before));
  });
});
