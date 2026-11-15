import { describe, it, expect } from 'vitest';
import { exportPlan, outputToSource, planCovered, MAX_OUTPUT_EDGE } from './export';
import { DEFAULT_STATE, editorReducer, type Action, type EditorState } from './editorState';

/**
 * The exporter draws the preview's own transform at one scale. These pin that
 * down from the outside: where output pixels sample the source photo.
 */

// A 1600×1200 working image shown at 400×300 in a 400×600 stage: the square
// frame is 300 on a side, and one display px is four source px.
const SOURCE = { width: 1600, height: 1200 };
function editor(...actions: Action[]): EditorState {
  return [
    { type: 'SET_MEDIA', media: { width: 400, height: 300 } } as Action,
    { type: 'SET_CONTAINER', container: { width: 400, height: 600 } } as Action,
    ...actions,
  ].reduce(editorReducer, DEFAULT_STATE);
}
/** The plan without the hairline overscan, so the sampling is exact. */
function exact(state: EditorState, source = SOURCE) {
  return { ...exportPlan(state, source), overscan: 1 };
}

describe('exportPlan', () => {
  it('refuses to plan before the cropper has measured the photo', () => {
    expect(() => exportPlan(DEFAULT_STATE, SOURCE)).toThrow();
  });

  it('at rest, saves the centred square at the photo’s own resolution', () => {
    const plan = exact(editor());
    expect([plan.outW, plan.outH]).toEqual([1200, 1200]);
    expect(outputToSource(plan, 0, 0)).toEqual({ x: 200, y: 0 });
    expect(outputToSource(plan, 1200, 1200)).toEqual({ x: 1400, y: 1200 });
  });

  it('saves what the preview frames: a pan moves the sample by the same amount', () => {
    // Photo dragged 50 display px right → the frame sees 50 px further left.
    const plan = exact(editor({ type: 'SET_CROP', crop: { x: 50, y: 0 } }));
    const centre = outputToSource(plan, plan.outW / 2, plan.outH / 2);
    expect(centre.x).toBeCloseTo(800 - 50 * 4, 6);
    expect(centre.y).toBeCloseTo(600, 6);
  });

  it('mirrors on flip and turns the right way on a quarter turn', () => {
    const flipped = exact(editor({ type: 'FLIP_H' }));
    expect(outputToSource(flipped, 0, 0).x).toBeCloseTo(1400, 6);

    // Rotated 90° clockwise, the new top-left is the old bottom-left.
    const turned = exact(editor({ type: 'ROTATE_CW' }));
    const tl = outputToSource(turned, 0, 0);
    expect(tl.x).toBeCloseTo(200, 6);
    expect(tl.y).toBeCloseTo(1200, 6);
  });

  it('never samples outside the photo, whatever the edit', () => {
    let seed = 11;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (let i = 0; i < 2000; i++) {
      const actions: Action[] = [];
      for (let r = Math.floor(rand() * 4); r > 0; r--) actions.push({ type: 'ROTATE_CW' });
      actions.push({ type: 'SET_STRAIGHTEN', degrees: rand() * 90 - 45 });
      if (rand() < 0.5) actions.push({ type: 'FLIP_H' });
      if (rand() < 0.5) actions.push({ type: 'FLIP_V' });
      actions.push({ type: 'SET_ZOOM', zoom: rand() * 6 });
      actions.push({ type: 'SET_CROP', crop: { x: (rand() - 0.5) * 3000, y: (rand() - 0.5) * 3000 } });
      expect(planCovered(exact(editor(...actions)))).toBe(true);
    }
  });

  it('caps the saved photo’s long edge', () => {
    const big = { width: 4000, height: 3000 };
    const plan = exportPlan(editor(), big);
    expect(Math.max(plan.outW, plan.outH)).toBe(MAX_OUTPUT_EDGE);
  });

  it('overscans by a hairline so an edge-aligned frame can’t leave a seam', () => {
    const plan = exportPlan(editor(), SOURCE);
    expect(plan.overscan).toBeGreaterThan(1);
    expect(plan.overscan).toBeLessThan(1.01);
  });
});
