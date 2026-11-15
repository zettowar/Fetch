interface BoneProgressProps {
  value: number;
  max: number;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

/**
 * The swipe meter (Brand Book, The app): a track with a toe bean for a thumb.
 * It counts down to something, never up to nothing. Tone follows what's
 * left: empty → danger, ≤20% → warning, else Ball Orange. Keeps the standard
 * `role="progressbar"` contract.
 */
export default function BoneProgress({
  value,
  max,
  size = 'md',
  label,
  className = '',
}: BoneProgressProps) {
  const clamped = Math.max(0, Math.min(value, max));
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  const tone = clamped === 0 ? 'bg-danger-400' : pct <= 20 ? 'bg-warning-400' : 'bg-brand-500';
  const track = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const thumb = size === 'sm' ? 'h-3 w-3 -ml-1.5' : 'h-4 w-4 -ml-2';

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-label={label ?? `${clamped} of ${max}`}
      className={`relative rounded-full bg-navy/10 dark:bg-white/10 ${track} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ease-soft-out ${tone}`}
        style={{ width: `${pct}%` }}
      />
      <span
        aria-hidden
        className={`absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-navy dark:border-biscuit transition-all duration-300 ease-soft-out ${thumb} ${
          clamped === 0 ? 'bg-white dark:bg-night-surface' : tone
        }`}
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
