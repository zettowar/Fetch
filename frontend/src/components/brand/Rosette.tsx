import type { ReactNode } from 'react';
import { Crown } from './RankMedal';

const ROSETTE =
  'M100.0 20.0Q116.3 -2.7 124.7 23.9Q147.2 7.3 147.0 35.3Q173.5 26.5 164.7 53.0Q192.7 52.8 176.1 75.3Q202.7 83.7 180.0 100.0Q202.7 116.3 176.1 124.7Q192.7 147.2 164.7 147.0Q173.5 173.5 147.0 164.7Q147.2 192.7 124.7 176.1Q116.3 202.7 100.0 180.0Q83.7 202.7 75.3 176.1Q52.8 192.7 53.0 164.7Q26.5 173.5 35.3 147.0Q7.3 147.2 23.9 124.7Q-2.7 116.3 20.0 100.0Q-2.7 83.7 23.9 75.3Q7.3 52.8 35.3 53.0Q26.5 26.5 53.0 35.3Q52.8 7.3 75.3 23.9Q83.7 -2.7 100.0 20.0Z';

/**
 * The rosette (Brand Book, Shapes): the weekly crown made physical. One Top
 * Dog and one Top Cat per week — the only place gold appears in quantity.
 * `title` rides the top of the medallion ("TOP DOG"), `children` fills the
 * centre (a pet's photo or portrait; the crown when empty), `caption` sits
 * on the lower rim (a week, a city).
 */
export default function Rosette({
  title,
  caption,
  children,
  className = '',
}: {
  title: string;
  caption?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={`relative inline-block aspect-[200/270] ${className}`} role="img" aria-label={`${title} rosette`}>
      <svg viewBox="0 0 200 270" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <path d="M80 150 58 258 78 245 94 264 108 158Z" fill="#FF6A1F" stroke="#1C1F45" strokeWidth="5" strokeLinejoin="round" />
        <path d="M120 150 142 258 122 245 106 264 92 158Z" fill="#FFF2E3" stroke="#1C1F45" strokeWidth="5" strokeLinejoin="round" />
        <path d={ROSETTE} fill="#FFC233" stroke="#1C1F45" strokeWidth="5" strokeLinejoin="round" />
        <circle cx="100" cy="100" r="62" fill="#FFFFFF" stroke="#1C1F45" strokeWidth="4" />
        <circle cx="100" cy="100" r="54" fill="none" stroke="#1C1F45" strokeWidth="1.6" strokeDasharray="1 5" strokeLinecap="round" opacity=".55" />
        <text x="100" y="64" textAnchor="middle" fontFamily="Figtree, sans-serif" fontWeight="900" fontSize="14" letterSpacing="2.4" fill="#1C1F45">
          {title.toUpperCase()}
        </text>
        {caption && (
          <text x="100" y="149" textAnchor="middle" fontFamily="Figtree, sans-serif" fontWeight="800" fontSize="10" letterSpacing="1.6" fill="#5D6085">
            {caption.toUpperCase()}
          </text>
        )}
      </svg>
      {/* Centre: a circle at (100,103) r≈36 of the 200×270 frame. */}
      <span className="absolute left-[32%] top-[24.5%] flex h-[26.5%] w-[36%] items-center justify-center overflow-hidden rounded-full">
        {children ?? <Crown className="w-[70%]" />}
      </span>
    </span>
  );
}
