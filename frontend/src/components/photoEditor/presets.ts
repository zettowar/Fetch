import type { Adjustments, FilterKey } from './editorState';

export interface FilterPreset {
  label: string;
  /** CSS `filter` string. `'none'` means the preset contributes nothing. */
  css: string;
}

// Tuned for fur + outdoor light; steer away from heavy 2016-Instagram tints.
export const FILTERS: Record<FilterKey, FilterPreset> = {
  none: { label: 'Original', css: 'none' },
  clean: { label: 'Clean', css: 'contrast(1.05) saturate(1.08)' },
  bright: {
    label: 'Bright',
    css: 'brightness(1.08) contrast(1.06) saturate(1.05)',
  },
  warm: { label: 'Warm', css: 'sepia(0.18) saturate(1.15) contrast(1.04)' },
  cool: {
    label: 'Cool',
    css: 'hue-rotate(-8deg) saturate(1.08) brightness(1.02)',
  },
  mono: { label: 'Mono', css: 'grayscale(1) contrast(1.1)' },
  sepia: { label: 'Sepia', css: 'sepia(0.6) contrast(1.05) brightness(1.02)' },
  vivid: { label: 'Vivid', css: 'saturate(1.35) contrast(1.12)' },
  soft: { label: 'Soft', css: 'contrast(0.92) saturate(0.95) brightness(1.05)' },
  dusk: {
    label: 'Dusk',
    css: 'sepia(0.25) hue-rotate(-12deg) saturate(1.1) contrast(1.05)',
  },
};

/** Display order for the filter strip. */
export const FILTER_ORDER: FilterKey[] = [
  'none',
  'clean',
  'bright',
  'vivid',
  'warm',
  'cool',
  'soft',
  'dusk',
  'sepia',
  'mono',
];

/** Turn adjustment sliders into a single CSS filter expression. */
export function adjFilterString(a: Adjustments): string {
  const b = 1 + a.brightness / 200; // ±50%
  const c = 1 + a.contrast / 150; // ±67%
  const s = 1 + a.saturation / 100; // ±100%
  const hue = -a.warmth * 0.12; // ±12deg cool↔warm
  const sep = Math.max(0, a.warmth) / 400; // up to +0.25 sepia boost on the warm side
  return `brightness(${b.toFixed(3)}) contrast(${c.toFixed(
    3,
  )}) saturate(${s.toFixed(3)}) hue-rotate(${hue.toFixed(
    2,
  )}deg) sepia(${sep.toFixed(3)})`;
}

/** Compose preset + adjustments into a single CSS filter string. */
export function toFilterString(filter: FilterKey, adj: Adjustments): string {
  const preset = FILTERS[filter].css === 'none' ? '' : FILTERS[filter].css;
  const adjustments = adjFilterString(adj);
  return preset ? `${preset} ${adjustments}` : adjustments;
}
