import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STATE,
  editorReducer,
  isDirty,
  type EditorState,
} from './editorState';

describe('editorReducer', () => {
  it('applies a crop change', () => {
    const out = editorReducer(DEFAULT_STATE, {
      type: 'SET_CROP',
      crop: { x: 10, y: -5 },
    });
    expect(out.crop).toEqual({ x: 10, y: -5 });
  });

  it('clamps zoom to [1, 5] at rest', () => {
    const lo = editorReducer(DEFAULT_STATE, { type: 'SET_ZOOM', zoom: 0.1 });
    expect(lo.zoom).toBe(1);
    const hi = editorReducer(DEFAULT_STATE, { type: 'SET_ZOOM', zoom: 99 });
    expect(hi.zoom).toBe(5);
  });

  it('once measured, keeps the frame on the photo: zooms in to straighten, pulls a pan back', () => {
    let s = [
      { type: 'SET_MEDIA', media: { width: 400, height: 300 } } as const,
      { type: 'SET_CONTAINER', container: { width: 400, height: 600 } } as const,
    ].reduce(editorReducer, DEFAULT_STATE);
    expect(s.zoom).toBe(1);
    s = editorReducer(s, { type: 'SET_STRAIGHTEN', degrees: 10 });
    expect(s.zoom).toBeGreaterThan(1);
    // Zooming back out stops at the minimum that still covers the frame.
    const out = editorReducer(s, { type: 'SET_ZOOM', zoom: 1 });
    expect(out.zoom).toBeCloseTo(s.zoom, 9);
    // A wild pan lands on the nearest offset that keeps the frame covered.
    const pan = editorReducer(s, { type: 'SET_CROP', crop: { x: 900, y: 0 } });
    expect(pan.crop.x).toBeLessThan(100);
  });

  it('re-centres on a quarter turn', () => {
    const start: EditorState = { ...DEFAULT_STATE, crop: { x: 40, y: 0 } };
    expect(editorReducer(start, { type: 'ROTATE_CW' }).crop).toEqual({ x: 0, y: 0 });
  });

  it('rotates clockwise and wraps at 360', () => {
    let s = DEFAULT_STATE;
    s = editorReducer(s, { type: 'ROTATE_CW' });
    expect(s.rotation).toBe(90);
    s = editorReducer(s, { type: 'ROTATE_CW' });
    s = editorReducer(s, { type: 'ROTATE_CW' });
    s = editorReducer(s, { type: 'ROTATE_CW' });
    expect(s.rotation).toBe(0);
  });

  it('rotates counter-clockwise', () => {
    const s = editorReducer(DEFAULT_STATE, { type: 'ROTATE_CCW' });
    expect(s.rotation).toBe(270);
  });

  it('straighten clamps to ±45', () => {
    const a = editorReducer(DEFAULT_STATE, { type: 'SET_STRAIGHTEN', degrees: 60 });
    expect(a.straighten).toBe(45);
    const b = editorReducer(DEFAULT_STATE, { type: 'SET_STRAIGHTEN', degrees: -99 });
    expect(b.straighten).toBe(-45);
  });

  it('flips toggle', () => {
    const once = editorReducer(DEFAULT_STATE, { type: 'FLIP_H' });
    expect(once.flipH).toBe(true);
    const twice = editorReducer(once, { type: 'FLIP_H' });
    expect(twice.flipH).toBe(false);
  });

  it('SET_ADJ clamps to ±100 and RESET_ADJ zeros a channel without touching others', () => {
    const s = editorReducer(DEFAULT_STATE, {
      type: 'SET_ADJ',
      key: 'brightness',
      value: 200,
    });
    expect(s.adjustments.brightness).toBe(100);
    const t = editorReducer(s, {
      type: 'SET_ADJ',
      key: 'saturation',
      value: -40,
    });
    expect(t.adjustments.saturation).toBe(-40);
    const u = editorReducer(t, { type: 'RESET_ADJ', key: 'brightness' });
    expect(u.adjustments.brightness).toBe(0);
    expect(u.adjustments.saturation).toBe(-40);
  });

  it('RESET wipes the edit but keeps the current tab and the measurements', () => {
    let s: EditorState = { ...DEFAULT_STATE, tab: 'filter', rotation: 90 };
    s = editorReducer(s, { type: 'FLIP_H' });
    s = editorReducer(s, { type: 'SET_FILTER', filter: 'vivid' });
    s = editorReducer(s, { type: 'SET_ADJ', key: 'contrast', value: 40 });
    const reset = editorReducer(s, { type: 'RESET' });
    expect(reset.tab).toBe('filter');
    expect(reset.rotation).toBe(0);
    expect(reset.flipH).toBe(false);
    expect(reset.filter).toBe('none');
    expect(reset.adjustments.contrast).toBe(0);
  });
});

describe('isDirty', () => {
  it('default state is clean', () => {
    expect(isDirty(DEFAULT_STATE)).toBe(false);
  });

  it('any single modification flips it dirty', () => {
    expect(
      isDirty(
        editorReducer(DEFAULT_STATE, { type: 'SET_FILTER', filter: 'warm' }),
      ),
    ).toBe(true);
    expect(
      isDirty(editorReducer(DEFAULT_STATE, { type: 'ROTATE_CW' })),
    ).toBe(true);
    expect(
      isDirty(
        editorReducer(DEFAULT_STATE, {
          type: 'SET_ADJ',
          key: 'brightness',
          value: 1,
        }),
      ),
    ).toBe(true);
  });
});
