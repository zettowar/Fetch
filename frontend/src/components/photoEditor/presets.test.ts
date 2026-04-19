import { describe, expect, it } from 'vitest';
import { DEFAULT_ADJUSTMENTS } from './editorState';
import { FILTERS, adjFilterString, toFilterString } from './presets';

describe('adjFilterString', () => {
  it('defaults produce a neutral-ish filter string', () => {
    const s = adjFilterString(DEFAULT_ADJUSTMENTS);
    expect(s).toContain('brightness(1.000)');
    expect(s).toContain('contrast(1.000)');
    expect(s).toContain('saturate(1.000)');
    expect(s).toContain('hue-rotate(0.00deg)');
    expect(s).toContain('sepia(0.000)');
  });

  it('positive warmth adds sepia and rotates hue negative', () => {
    const s = adjFilterString({ ...DEFAULT_ADJUSTMENTS, warmth: 100 });
    expect(s).toContain('hue-rotate(-12.00deg)');
    expect(s).toContain('sepia(0.250)');
  });

  it('negative warmth rotates hue positive and keeps sepia at 0', () => {
    const s = adjFilterString({ ...DEFAULT_ADJUSTMENTS, warmth: -50 });
    expect(s).toContain('hue-rotate(6.00deg)');
    expect(s).toContain('sepia(0.000)');
  });
});

describe('toFilterString', () => {
  it('omits the preset segment when filter is "none"', () => {
    const s = toFilterString('none', DEFAULT_ADJUSTMENTS);
    expect(s.startsWith('brightness(')).toBe(true);
  });

  it('concatenates preset + adjustments when a filter is selected', () => {
    const s = toFilterString('vivid', DEFAULT_ADJUSTMENTS);
    expect(s.startsWith(FILTERS.vivid.css)).toBe(true);
    expect(s).toContain('brightness(');
    expect(s).toContain('saturate(');
  });

  it('warmthInCss: false drops hue-rotate and sepia so the pixel pass owns warmth', () => {
    const withWarmth = { ...DEFAULT_ADJUSTMENTS, warmth: 80 };
    const preview = toFilterString('none', withWarmth, { warmthInCss: true });
    const forExport = toFilterString('none', withWarmth, { warmthInCss: false });
    expect(preview).toContain('hue-rotate');
    expect(preview).toContain('sepia(');
    expect(forExport).not.toContain('hue-rotate');
    expect(forExport).not.toContain('sepia(');
  });

  it('approxToneInCss: false drops the tone-curve approximation for highlights/shadows', () => {
    const withTone = { ...DEFAULT_ADJUSTMENTS, highlights: -40, shadows: 60 };
    const preview = toFilterString('none', withTone, { approxToneInCss: true });
    const forExport = toFilterString('none', withTone, { approxToneInCss: false });
    // Preview gets an extra brightness(...) for the tone approximation.
    expect(preview.match(/brightness\(/g)?.length ?? 0).toBeGreaterThan(
      forExport.match(/brightness\(/g)?.length ?? 0,
    );
  });
});
