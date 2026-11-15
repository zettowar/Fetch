const BEAN_SIZES = {
  sm: { outer: 'h-2 w-[7px]', inner: 'h-[9px] w-2', lift: 'mb-1.5', gap: 'gap-1' },
  md: { outer: 'h-3 w-[11px]', inner: 'h-[14px] w-[13px]', lift: 'mb-2.5', gap: 'gap-1.5' },
  lg: { outer: 'h-[18px] w-4', inner: 'h-[21px] w-[19px]', lift: 'mb-4', gap: 'gap-2.5' },
};

interface PawSpinnerProps {
  size?: keyof typeof BEAN_SIZES;
  label?: string;
  className?: string;
}

/**
 * The paw step (Brand Book, Motion): the loader. Four toe beans light up in
 * order, like a paw landing — 1.2s loop, 150ms stagger. With reduced motion
 * the beans stay lit. Same a11y contract as the old ring Spinner
 * (role="status" + sr-only label).
 */
export default function PawSpinner({ size = 'md', label = 'Loading', className = '' }: PawSpinnerProps) {
  const s = BEAN_SIZES[size];
  return (
    <div role="status" aria-label={label} className={`flex items-end ${s.gap} ${className}`}>
      {[s.outer, s.inner, s.inner, s.outer].map((dims, i) => (
        <span
          key={i}
          aria-hidden
          className={`block rounded-full bg-brand-500 animate-paw-step ${dims} ${i === 1 || i === 2 ? s.lift : ''}`}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
