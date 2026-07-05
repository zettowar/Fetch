import type { HTMLAttributes, ReactNode } from 'react';

type BadgeVariant = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

const VARIANTS: Record<BadgeVariant, string> = {
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  success: 'bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-300',
  // amber-700 is too light against amber-100; step down for contrast
  warning: 'bg-warning-100 text-warning-800 dark:bg-warning-500/15 dark:text-warning-300',
  danger: 'bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-300',
  info: 'bg-info-100 text-info-700 dark:bg-info-500/15 dark:text-info-300',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const SIZES = {
  sm: 'px-2 py-0.5 text-2xs',
  md: 'px-2.5 py-1 text-xs',
};

/**
 * Status/trait pill. One component for every hand-rolled
 * `px-2 py-0.5 rounded-full` badge in the app; variants document the
 * color semantics: success=active/approved, warning=pending,
 * danger=urgent/suspended, info=informational, brand=traits/features.
 */
export default function Badge({
  variant = 'neutral',
  size = 'sm',
  icon,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold leading-none whitespace-nowrap ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon && (
        <span className="shrink-0 leading-none" aria-hidden>
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
