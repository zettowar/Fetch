import { useId, type CSSProperties } from 'react';

/**
 * The Crown Paw — Fetchpawz's mark (Brand Book, Logo chapter).
 *
 * Four toe beans are the points of a crown, the pad is the crown's band, and
 * a heart is cut out of the middle: a pet, a winner and the rescue mission in
 * one shape that still reads at 16px. Renders in `currentColor`, so it is
 * Ball Orange on Biscuit or white, and Leash Navy on any colour fill.
 *
 * `simple` drops the heart and plumps the beans — use it below 24px (tab
 * icons, favicons, the loader), where the cut-out closes up.
 */
export default function PawMark({
  className = '',
  title = 'Fetchpawz',
  decorative = false,
  simple = false,
  style,
}: {
  className?: string;
  title?: string;
  decorative?: boolean;
  simple?: boolean;
  style?: CSSProperties;
}) {
  const maskId = `heart-cut-${useId().replace(/:/g, '')}`;
  const a11y = decorative
    ? ({ 'aria-hidden': true, focusable: false } as const)
    : ({ role: 'img', 'aria-label': title } as const);
  return (
    <svg
      viewBox="4 7.75 112 112"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      {...a11y}
    >
      {!decorative && <title>{title}</title>}
      {simple ? (
        <g fill="currentColor">
          <circle cx="19" cy="47" r="12" />
          <circle cx="44" cy="25" r="13.5" />
          <circle cx="76" cy="25" r="13.5" />
          <circle cx="101" cy="47" r="12" />
          <path
            d="M21 68 36 77 45 48 60 66 75 48 84 77 99 68C100 84 98 94 92 100 82 109 70 111 60 111S38 109 28 100C22 94 20 84 21 68Z"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinejoin="round"
          />
        </g>
      ) : (
        <>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
            <rect x="0" y="0" width="120" height="120" fill="#fff" />
            <path
              d="M60 99C52 93 47 89 47 83.5 47 79.5 50 77 53.5 77c3 0 5.1 1.8 6.5 4 1.4-2.2 3.5-4 6.5-4 3.5 0 6.5 2.5 6.5 6.5C73 89 68 93 60 99Z"
              fill="#000"
              transform="translate(60 91) scale(1.08) translate(-60 -88)"
            />
          </mask>
          <g fill="currentColor" mask={`url(#${maskId})`}>
            <circle cx="19" cy="47" r="11" />
            <circle cx="44" cy="25" r="12.5" />
            <circle cx="76" cy="25" r="12.5" />
            <circle cx="101" cy="47" r="11" />
            <path
              d="M21 68 36 77 45 48 60 66 75 48 84 77 99 68C100 84 98 94 92 100 82 109 70 111 60 111S38 109 28 100C22 94 20 84 21 68Z"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinejoin="round"
            />
          </g>
        </>
      )}
    </svg>
  );
}
