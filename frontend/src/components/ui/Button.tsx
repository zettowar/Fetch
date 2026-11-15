import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * primary: Ball Orange — one per screen. secondary: white. danger:
   * destructive only. ghost: everything else. rescue (Forever Pink) and park
   * (Off-Leash Green) appear only inside their own features.
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'rescue' | 'park';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

// The classes live in index.css (.btn, .btn-primary …) so a <Link> styled as
// a button and a <Button> can never drift apart.
const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  rescue: 'btn-rescue',
  park: 'btn-park',
  ghost: 'btn-ghost',
};

const sizes = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        // Loading swaps the label for the paw-step beans and keeps the width.
        <span aria-hidden className="absolute inset-0 flex items-center justify-center gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`block h-1.5 w-1.5 rounded-full bg-current animate-paw-step ${i === 1 || i === 2 ? '-translate-y-1' : ''}`}
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      )}
      <span className={`inline-flex items-center justify-center gap-2 ${loading ? 'invisible' : ''}`}>{children}</span>
    </button>
  );
}
