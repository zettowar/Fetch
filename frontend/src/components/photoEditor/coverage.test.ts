import { describe, it, expect } from 'vitest';
import {
  clampOffset,
  frameCovered,
  frameCornersOnMedia,
  minZoomToCover,
  squareFrame,
} from './coverage';

const sq = (n: number) => ({ width: n, height: n });

// A small seeded PRNG so the property sweeps are deterministic.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('minZoomToCover', () => {
  it('is 1 at quarter turns, where the frame is sized to fit the photo', () => {
    const media = { width: 400, height: 300 };
    for (const deg of [0, 90, 180, 270]) {
      expect(minZoomToCover(squareFrame(media, sq(1000), deg), media, deg)).toBeCloseTo(1, 9);
    }
  });

  it('is √2 for a square photo straightened 45° under a full frame', () => {
    expect(minZoomToCover(sq(300), sq(300), 45)).toBeCloseTo(Math.SQRT2, 9);
  });

  it('grows with the straighten angle and is symmetric in its sign', () => {
    const media = { width: 400, height: 300 };
    const frame = squareFrame(media, sq(1000), 0);
    const z5 = minZoomToCover(frame, media, 5);
    const z15 = minZoomToCover(frame, media, 15);
    expect(z5).toBeGreaterThan(1);
    expect(z15).toBeGreaterThan(z5);
    expect(minZoomToCover(frame, media, -15)).toBeCloseTo(z15, 9);
  });

  it('covers the frame exactly at the minimum, and not a hair below it', () => {
    const media = { width: 400, height: 300 };
    const frame = squareFrame(media, sq(1000), 0);
    for (const deg of [3, 12.5, -30, 44]) {
      const z = minZoomToCover(frame, media, deg);
      expect(frameCovered({ x: 0, y: 0 }, frame, media, z, deg)).toBe(true);
      expect(frameCovered({ x: 0, y: 0 }, frame, media, z * 0.995, deg)).toBe(false);
    }
  });
});

describe('squareFrame', () => {
  it('is the photo’s short side, swapping axes on a quarter turn', () => {
    const media = { width: 400, height: 300 };
    expect(squareFrame(media, sq(1000), 0)).toEqual(sq(300));
    expect(squareFrame(media, sq(1000), 90)).toEqual(sq(300));
  });

  it('never outgrows the container', () => {
    expect(squareFrame({ width: 600, height: 500 }, { width: 380, height: 700 }, 0)).toEqual(sq(380));
  });
});

describe('clampOffset', () => {
  it('matches the cropper’s own per-axis clamp at 0°', () => {
    const media = { width: 400, height: 300 };
    const frame = sq(300);
    // At zoom 1 the frame spans the photo's height, so only x can move: ±50.
    expect(clampOffset({ x: 120, y: 40 }, frame, media, 1, 0)).toEqual({ x: 50, y: 0 });
    expect(clampOffset({ x: -10, y: 0 }, frame, media, 1, 0)).toEqual({ x: -10, y: 0 });
  });

  it('leaves a legal offset untouched', () => {
    const media = { width: 400, height: 300 };
    const frame = sq(300);
    const p = { x: 12, y: -7 };
    const z = minZoomToCover(frame, media, 10) * 1.3;
    expect(clampOffset(p, frame, media, z, 10)).toEqual(p);
  });

  it('slides along an edge instead of sticking (nearest legal offset)', () => {
    const media = { width: 400, height: 300 };
    const frame = sq(300);
    // Dragging diagonally into the right-hand limit keeps the vertical part.
    const out = clampOffset({ x: 500, y: 20 }, frame, media, 1.5, 0);
    expect(out.x).toBeCloseTo(150, 9);
    expect(out.y).toBeCloseTo(20, 9);
  });

  it('always lands on a covered, stable offset — any angle, zoom and drag', () => {
    const rand = rng(7);
    for (let i = 0; i < 4000; i++) {
      const media = { width: 120 + rand() * 900, height: 120 + rand() * 900 };
      const quarter = Math.floor(rand() * 4) * 90;
      const deg = quarter + (rand() * 90 - 45);
      const frame = squareFrame(media, { width: 200 + rand() * 900, height: 200 + rand() * 900 }, quarter);
      const z = minZoomToCover(frame, media, deg) * (1 + rand() * 3);
      const wild = { x: (rand() - 0.5) * 4000, y: (rand() - 0.5) * 4000 };
      const p = clampOffset(wild, frame, media, z, deg);
      expect(frameCovered(p, frame, media, z, deg, 1e-6)).toBe(true);
      const again = clampOffset(p, frame, media, z, deg);
      expect(again.x).toBeCloseTo(p.x, 9);
      expect(again.y).toBeCloseTo(p.y, 9);
    }
  });
});

describe('frameCornersOnMedia', () => {
  it('maps the frame straight onto the photo centre at rest', () => {
    const corners = frameCornersOnMedia({ x: 0, y: 0 }, sq(300), 1, 0);
    expect(corners).toEqual([
      { x: -150, y: -150 },
      { x: 150, y: -150 },
      { x: 150, y: 150 },
      { x: -150, y: 150 },
    ]);
  });
});
