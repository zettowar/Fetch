import PawMark from '../ui/PawMark';

const PAW_SIZES = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3.5 w-3.5',
  lg: 'h-5 w-5',
};

interface PawSpinnerProps {
  size?: keyof typeof PAW_SIZES;
  label?: string;
  className?: string;
}

/**
 * Pet-walk loading indicator: four paw prints stepping in sequence,
 * alternating left/right like a trotting trail. Same a11y contract as
 * the old ring Spinner (role="status" + sr-only label).
 */
export default function PawSpinner({ size = 'md', label = 'Loading', className = '' }: PawSpinnerProps) {
  return (
    <div role="status" aria-label={label} className={`flex items-end gap-1.5 text-brand-500 ${className}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className={`animate-paw-step ${i % 2 === 0 ? 'translate-y-[3px]' : '-translate-y-[3px]'}`}
          style={{ animationDelay: `${i * 150}ms` }}
          aria-hidden
        >
          <PawMark decorative className={`${PAW_SIZES[size]} rotate-90`} />
        </span>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
