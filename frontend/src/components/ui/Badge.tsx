import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant =
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'gold'
  | 'rescue'
  | 'missing'
  | 'review';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

// A badge states a fact about a pet or a place. Pill, a Leash Navy line and
// navy text on every fill. The reserved colours keep their jobs: gold is
// earned (rank, crown), pink is a rescue, green is verified / found / at the
// park, the navy pill with an orange dot is a missing pet, and a dashed
// outline is something held for review.
const VARIANTS: Record<BadgeVariant, string> = {
  brand: 'bg-brand-100 text-navy border-navy/80 dark:bg-brand-500/20 dark:text-brand-200 dark:border-brand-400/50',
  success: 'bg-success-500 text-navy border-navy',
  warning: 'bg-warning-100 text-navy border-navy/80 dark:bg-warning-500/20 dark:text-warning-200 dark:border-warning-400/50',
  danger: 'bg-danger-100 text-danger-800 border-danger-500 dark:bg-danger-500/20 dark:text-danger-200 dark:border-danger-400/60',
  info: 'bg-navy-100 text-navy border-navy/70 dark:bg-white/10 dark:text-gray-100 dark:border-white/30',
  neutral: 'bg-white text-gray-700 border-gray-300 dark:bg-night-raised dark:text-gray-200 dark:border-white/20',
  gold: 'bg-gold-500 text-navy border-navy',
  rescue: 'bg-pink-500 text-navy border-navy',
  missing:
    'bg-navy text-biscuit border-navy uppercase tracking-[0.08em] before:content-[""] before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand-500 dark:border-biscuit/40',
  review: 'bg-transparent text-gray-700 border-gray-400 border-dashed dark:text-gray-200 dark:border-white/40',
};

const SIZES = {
  sm: 'px-2 py-[3px] text-2xs border-[1.5px]',
  md: 'px-2.5 py-1 text-xs border-2',
};

/**
 * Status/trait pill. One component for every hand-rolled
 * `px-2 py-0.5 rounded-full` badge in the app. Semantics:
 * success = active/approved/verified/found · warning = pending/attention ·
 * danger = urgent/suspended (never Lost & Found) · info = informational ·
 * brand = features · neutral = everything else · gold = earned ·
 * rescue = needs a home · missing = a lost pet · review = held for review.
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
      className={`inline-flex items-center gap-1 rounded-full font-extrabold leading-none whitespace-nowrap ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
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
