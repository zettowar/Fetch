import type { CSSProperties } from 'react';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 140,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/* The drawn wordmark (Brand Book, Logo chapter): monoline lowercase on a
 * 1000-unit grid, "tch" as one stroke, a single-storey a, and a z whose
 * bottom bar runs on into a tail that swings back to a toe bean. It is
 * drawn, never typeset — do not replace it with Bagel Fat One text. */
const LETTERS = [
  'M230 950V330C230 190 270 95 415 100C485 102 520 135 502 172',
  'M110 325H380',
  'M458 480H890A216 216 0 1 0 793 666',
  'M1044 185V600C1044 680 1104 730 1234 705C1289 700 1322 660 1324 622',
  'M914 325H1179',
  'M1642 324A216 216 0 1 0 1642 636C1712 650 1758 652 1818 630',
  'M1818 150V690',
  'M1818 520C1818 190 2148 190 2148 520V690',
  'M2308 270V950',
  'M2308 280A220 210 -14 1 1 2308 680',
  'M3078 270V690',
  'M3074 480A222 210 -14 1 0 2630 480A222 210 -14 1 0 3074 480',
  'M3198 270L3298 615Q3328 765 3363 615L3458 440L3553 615Q3588 765 3618 615L3718 270',
  'M3830 270H4160L3830 690H4120',
];

/**
 * `wag` swings the tail once on mount (the logo's own move, 900ms). It
 * respects reduced motion through the global rule in index.css.
 */
export default function Wordmark({
  className = '',
  title = 'Fetchpawz',
  decorative = false,
  wag = false,
  style,
}: {
  className?: string;
  title?: string;
  decorative?: boolean;
  wag?: boolean;
  style?: CSSProperties;
}) {
  const a11y = decorative
    ? ({ 'aria-hidden': true, focusable: false } as const)
    : ({ role: 'img', 'aria-label': title } as const);
  return (
    <svg
      viewBox="0 -30 4400 1140"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      {...a11y}
    >
      {!decorative && <title>{title}</title>}
      {LETTERS.map((d) => (
        <path key={d} d={d} {...STROKE} />
      ))}
      <g
        className={wag ? 'animate-tail-wag' : undefined}
        style={{ transformOrigin: '4120px 690px', transformBox: 'view-box' }}
      >
        <path d="M4120 690C4290 690 4350 800 4280 905C4260 935 4230 940 4210 919" {...STROKE} />
        <circle cx="4210" cy="919" r="101" fill="currentColor" />
      </g>
    </svg>
  );
}
