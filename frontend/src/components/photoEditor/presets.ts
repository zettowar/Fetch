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

export interface FilterStringOptions {
  /**
   * When true (default: preview), warmth is approximated via hue-rotate+sepia
   * so the slider shows *some* live change. When false (export pipeline), the
   * CSS component is skipped and the real per-channel warmth is applied as
   * part of the pixel pass. Passing false when exporting prevents the warmth
   * effect from being doubled.
   */
  warmthInCss?: boolean;
  /**
   * When true (preview), highlights/shadows get a crude brightness/contrast
   * approximation so the sliders visibly change the image while the real
   * luma-weighted tone pass is saved for export.
   */
  approxToneInCss?: boolean;
}

/** Map the three CSS-native adjustments (and optional approximations of the
 * pixel-pass ones) into a single CSS `filter:` expression. */
export function adjFilterString(
  a: Adjustments,
  opts: FilterStringOptions = {},
): string {
  const { warmthInCss = true, approxToneInCss = true } = opts;

  const b = 1 + a.brightness / 200; // ±50%
  const c = 1 + a.contrast / 150; // ±67%
  const s = 1 + a.saturation / 100; // ±100%

  const parts: string[] = [
    `brightness(${b.toFixed(3)})`,
    `contrast(${c.toFixed(3)})`,
    `saturate(${s.toFixed(3)})`,
  ];

  if (warmthInCss) {
    const hue = -a.warmth * 0.12; // ±12deg cool↔warm
    const sep = Math.max(0, a.warmth) / 400; // up to +0.25 sepia on warm side
    parts.push(`hue-rotate(${hue.toFixed(2)}deg)`);
    parts.push(`sepia(${sep.toFixed(3)})`);
  }

  if (approxToneInCss) {
    // Rough stand-in for the per-pixel luma-weighted tone pass. Positive
    // highlights ≈ slightly darker + more contrast; positive shadows ≈
    // slightly brighter + less contrast. Enough to give the slider visible
    // motion without fighting the real pass that runs on export.
    const toneB = 1 + a.shadows / 500 - a.highlights / 600;
    const toneC = 1 + a.highlights / 600 - a.shadows / 700;
    if (Math.abs(toneB - 1) > 1e-4 || Math.abs(toneC - 1) > 1e-4) {
      parts.push(`brightness(${toneB.toFixed(3)})`);
      parts.push(`contrast(${toneC.toFixed(3)})`);
    }
  }

  return parts.join(' ');
}

/** Compose preset + adjustments into a single CSS filter string. */
export function toFilterString(
  filter: FilterKey,
  adj: Adjustments,
  opts: FilterStringOptions = {},
): string {
  const preset = FILTERS[filter].css === 'none' ? '' : FILTERS[filter].css;
  const adjustments = adjFilterString(adj, opts);
  return preset ? `${preset} ${adjustments}` : adjustments;
}
