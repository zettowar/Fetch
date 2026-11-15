/**
 * A drawn rank (Brand Book, The app → Badges). Only first place is gold —
 * a Crown Gold disc wearing the crown. Everyone else gets a plain number in a
 * navy ring, never silver or bronze: gold is earned, and there is one of it.
 */
export default function RankMedal({
  rank,
  size = 'md',
  className = '',
}: {
  rank: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = { sm: 'h-7 w-7 text-sm', md: 'h-9 w-9 text-lg', lg: 'h-12 w-12 text-2xl' }[size];
  const crown = { sm: 'w-4 -top-2.5', md: 'w-5 -top-3', lg: 'w-7 -top-4' }[size];
  const first = rank === 1;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full border-2 font-display leading-none ${dims} ${
        first
          ? 'border-navy bg-gold-500 text-navy'
          : 'border-navy/70 bg-white text-navy dark:border-white/40 dark:bg-night-raised dark:text-biscuit'
      } ${className}`}
      aria-label={`Rank ${rank}`}
    >
      {first && <Crown className={`absolute left-1/2 -translate-x-1/2 -rotate-6 ${crown}`} />}
      <span aria-hidden>{rank}</span>
    </span>
  );
}

/** The crown: Crown Gold with a Leash Navy line. For winners only. */
export function Crown({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 46 40" className={`overflow-visible ${className}`} aria-hidden focusable={false}>
      <path
        d="M5 34 3 13l10 8 10-15 10 15 10-8-2 21Z"
        fill="#FFC233"
        stroke="#1C1F45"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="3.5" cy="11" r="3.2" fill="#FFC233" stroke="#1C1F45" strokeWidth="2.5" />
      <circle cx="23" cy="5" r="3.6" fill="#FFC233" stroke="#1C1F45" strokeWidth="2.5" />
      <circle cx="42.5" cy="11" r="3.2" fill="#FFC233" stroke="#1C1F45" strokeWidth="2.5" />
    </svg>
  );
}
