import { describe, it, expect } from 'vitest';
import { exportGeometry, rotatedSize } from './export';
import { DEFAULT_STATE, type EditorState } from './editorState';

/**
 * These lock down the coordinate space `croppedAreaPixels` is expressed in:
 * the media's ROTATED BOUNDING BOX, per react-easy-crop's `computeCroppedArea`.
 * Getting this wrong (e.g. sizing the intermediate canvas to the image's
 * diagonal) offsets every crop and pulls empty canvas — which JPEG flattens to
 * black bands — into the exported photo.
 */

function stateWith(over: Partial<EditorState>): EditorState {
  return { ...DEFAULT_STATE, ...over };
}

const full = (w: number, h: number) => ({ x: 0, y: 0, width: w, height: h });

describe('rotatedSize', () => {
  it('is a no-op at 0°', () => {
    expect(rotatedSize(800, 600, 0)).toEqual({ width: 800, height: 600 });
  });

  it('swaps the axes at 90° and 270°', () => {
    for (const deg of [90, 270]) {
      const { width, height } = rotatedSize(800, 600, deg);
      expect(width).toBeCloseTo(600);
      expect(height).toBeCloseTo(800);
    }
  });

  it('grows to the enclosing box at 45°', () => {
    const { width, height } = rotatedSize(800, 600, 45);
    const expected = (800 + 600) / Math.SQRT2;
    expect(width).toBeCloseTo(expected);
    expect(height).toBeCloseTo(expected);
  });
});

describe('exportGeometry', () => {
  it('throws until the cropper has reported an area', () => {
    expect(() => exportGeometry(800, 600, DEFAULT_STATE)).toThrow(
      /No crop area/,
    );
  });

  it('makes the intermediate buffer the image itself when unrotated', () => {
    // The regression: an unedited photo must map 1:1, with no offset between
    // the crop origin and the image origin.
    const g = exportGeometry(
      800,
      600,
      stateWith({ croppedAreaPixels: full(800, 600) }),
    );
    expect(g.fit).toBe(1);
    expect(g.bboxW).toBe(800);
    expect(g.bboxH).toBe(600);
    expect(g.drawW).toBe(800);
    expect(g.drawH).toBe(600);
    expect([g.cropX, g.cropY, g.cropW, g.cropH]).toEqual([0, 0, 800, 600]);
  });

  it('keeps a full-frame crop flush with the buffer at every angle', () => {
    // A crop covering the whole bounding box must land exactly on it — any
    // gap is the black banding, any overhang is the off-centre framing.
    for (const rotation of [0, 90, 180, 270]) {
      const box = rotatedSize(800, 600, rotation);
      const g = exportGeometry(
        800,
        600,
        stateWith({
          rotation,
          croppedAreaPixels: full(
            Math.round(box.width),
            Math.round(box.height),
          ),
        }),
      );
      expect(g.cropX + g.cropW).toBeCloseTo(g.bboxW, 0);
      expect(g.cropY + g.cropH).toBeCloseTo(g.bboxH, 0);
    }
  });

  it('folds straighten into the rotation', () => {
    const g = exportGeometry(
      800,
      600,
      stateWith({ rotation: 90, straighten: -15, croppedAreaPixels: full(1, 1) }),
    );
    expect(g.rotationRad).toBeCloseTo((75 * Math.PI) / 180);
    const box = rotatedSize(800, 600, 75);
    expect(g.bboxW).toBeCloseTo(box.width);
    expect(g.bboxH).toBeCloseTo(box.height);
  });

  it('scales image, box and crop by one shared factor past the area cap', () => {
    // 4032×3024 rotated 45° needs a ~5000² box — over the browser cap, which
    // renders blank and exports as solid black. Everything must shrink together
    // or the crop drifts out of the (now smaller) buffer.
    const g = exportGeometry(
      4032,
      3024,
      stateWith({
        rotation: 45,
        croppedAreaPixels: { x: 1000, y: 900, width: 2000, height: 2000 },
      }),
    );
    expect(g.fit).toBeLessThan(1);
    expect(g.bboxW * g.bboxH).toBeLessThanOrEqual(16_000_000);
    expect(g.drawW / 4032).toBeCloseTo(g.fit);
    expect(g.cropX).toBeCloseTo(1000 * g.fit);
    expect(g.cropY).toBeCloseTo(900 * g.fit);
    expect(g.cropW).toBeCloseTo(2000 * g.fit);
    expect(g.cropH).toBeCloseTo(2000 * g.fit);
  });

  it('leaves normal-sized photos untouched', () => {
    const g = exportGeometry(
      1280,
      960,
      stateWith({ rotation: 45, croppedAreaPixels: full(600, 600) }),
    );
    expect(g.fit).toBe(1);
  });
});
