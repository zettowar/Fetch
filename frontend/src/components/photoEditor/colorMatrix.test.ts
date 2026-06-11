import { describe, expect, it } from 'vitest';
import {
  applyColorMatrix,
  filterStringToColorMatrix,
  isIdentityMatrix,
} from './colorMatrix';

/** ImageData-shaped stub (jsdom has no ImageData ctor; applyColorMatrix only
 *  reads `data`). Mirrors the helper in pixelOps.test.ts. */
function px(r: number, g: number, b: number): ImageData {
  const data = new Uint8ClampedArray([r, g, b, 255]);
  return { data, width: 1, height: 1, colorSpace: 'srgb' } as unknown as ImageData;
}

/** Run a CSS filter string against a single pixel; return [r,g,b]. */
function run(css: string, r: number, g: number, b: number): [number, number, number] {
  const img = px(r, g, b);
  applyColorMatrix(img, filterStringToColorMatrix(css));
  return [img.data[0], img.data[1], img.data[2]];
}

describe('filterStringToColorMatrix', () => {
  it('treats none / empty as identity', () => {
    expect(isIdentityMatrix(filterStringToColorMatrix('none'))).toBe(true);
    expect(isIdentityMatrix(filterStringToColorMatrix(''))).toBe(true);
  });

  it('identity filters leave pixels untouched', () => {
    expect(run('brightness(1) contrast(1) saturate(1)', 100, 150, 200)).toEqual([
      100, 150, 200,
    ]);
    expect(isIdentityMatrix(filterStringToColorMatrix('brightness(1)'))).toBe(true);
  });

  it('a real preset string is non-identity', () => {
    expect(isIdentityMatrix(filterStringToColorMatrix('brightness(2)'))).toBe(false);
    expect(
      isIdentityMatrix(filterStringToColorMatrix('sepia(0.6) contrast(1.05)')),
    ).toBe(false);
  });
});

describe('applyColorMatrix', () => {
  it('brightness scales channels and clamps at 255', () => {
    expect(run('brightness(2)', 100, 50, 10)).toEqual([200, 100, 20]);
    expect(run('brightness(2)', 200, 200, 200)).toEqual([255, 255, 255]); // clamped
    expect(run('brightness(0.5)', 100, 80, 40)).toEqual([50, 40, 20]);
  });

  it('contrast pushes brights brighter and darks darker around mid-gray', () => {
    const [hi] = run('contrast(2)', 200, 200, 200);
    const [lo] = run('contrast(2)', 50, 50, 50);
    expect(hi).toBeGreaterThan(200);
    expect(lo).toBeLessThan(50);
  });

  it('grayscale(1) yields equal channels (luma)', () => {
    const [r, g, b] = run('grayscale(1)', 100, 150, 200);
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBeCloseTo(143, 0); // 0.2126·100 + 0.7152·150 + 0.0722·200
  });

  it('saturate(0) desaturates to a single gray value', () => {
    const [r, g, b] = run('saturate(0)', 100, 150, 200);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('hue-rotate leaves a neutral gray unchanged', () => {
    // A pixel with R=G=B has no hue to rotate; each row's coefficients sum to 1.
    expect(run('hue-rotate(45deg)', 120, 120, 120)).toEqual([120, 120, 120]);
    expect(run('hue-rotate(-8deg)', 90, 90, 90)).toEqual([90, 90, 90]);
  });

  it('composes functions left-to-right', () => {
    // grayscale then saturate(2): saturating an already-gray pixel stays gray.
    const [r, g, b] = run('grayscale(1) saturate(2)', 30, 90, 210);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});
