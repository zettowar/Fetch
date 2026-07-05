import { Bone } from 'lucide-react';

interface BoneProgressProps {
  value: number;
  max: number;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

/**
 * Progress bar with a bone riding the fill edge. Tone follows the
 * remaining amount: empty → danger, ≤20% → warning, else brand — the
 * same thresholds the swipe quota bar used. Markup keeps the standard
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
  const tone =
    clamped === 0
      ? 'bg-danger-400 text-danger-400'
      : pct <= 20
        ? 'bg-warning-400 text-warning-400'
        : 'bg-brand-500 text-brand-500';
  const trackHeight = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-label={label ?? `${clamped} of ${max}`}
      className={`relative rounded-full bg-gray-100 dark:bg-gray-800 ${trackHeight} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ease-soft-out ${tone}`}
        style={{ width: `${pct}%` }}
      />
      <Bone
        size={14}
        fill="currentColor"
        aria-hidden
        className={`absolute top-1/2 -translate-y-1/2 -rotate-[20deg] transition-all duration-300 ease-soft-out ${tone.split(' ')[1]}`}
        style={{ left: `calc(${pct}% - 7px)` }}
      />
    </div>
  );
}
