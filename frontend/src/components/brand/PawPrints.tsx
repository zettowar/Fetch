import type { CSSProperties } from 'react';

/**
 * Paw prints: our own drawing of the 🐾 sign-off, for the places copy used
 * to reach for the emoji (Brand Book, Icons: "Never emoji: they look
 * different on every phone and can't take our colors").
 *
 * Two Crown Paw prints (the simple mark, as in PawTrail and PawBurst)
 * walking up and to the right, the way the line reads. The trailing print is
 * smaller rather than faded: a tint of orange goes muddy on Navy, and one
 * solid colour keeps it legible at text size.
 *
 * Sits inline at 1em tall and takes `currentColor`: Ball Orange on Biscuit
 * or white (the default), navy on a colour fill. Always decorative: the words
 * around it carry the meaning.
 *
 * The email PNG (`public/email-paw-prints.png`) and the print card are
 * renders of this same geometry; redraw them if it changes.
 */
export const PAW_PRINTS_VIEWBOX = '4 2 107 90';

const BEANS = (
  <>
    <circle cx="19" cy="47" r="12" />
    <circle cx="44" cy="25" r="13.5" />
    <circle cx="76" cy="25" r="13.5" />
    <circle cx="101" cy="47" r="12" />
  </>
);
const PAD =
  'M21 68 36 77 45 48 60 66 75 48 84 77 99 68C100 84 98 94 92 100 82 109 70 111 60 111S38 109 28 100C22 94 20 84 21 68Z';

function Print({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(32) scale(${scale}) translate(-60 -63.75)`}>
      {BEANS}
      <path d={PAD} stroke="currentColor" strokeWidth={10} strokeLinejoin="round" />
    </g>
  );
}

export default function PawPrints({
  className = 'text-brand-500',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox={PAW_PRINTS_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable={false}
      className={`inline-block shrink-0 ${className}`}
      style={{ height: '1em', width: '1.19em', verticalAlign: '-0.14em', ...style }}
      data-testid="paw-prints"
    >
      <g fill="currentColor">
        <Print x={27} y={68} scale={0.4} />
        <Print x={80} y={33} scale={0.52} />
      </g>
    </svg>
  );
}
