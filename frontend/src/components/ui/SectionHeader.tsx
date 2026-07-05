import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * In-page section heading (h2 tier of the type scale) with an optional
 * leading icon and a right-aligned action slot (usually a "See all" link).
 */
export default function SectionHeader({ title, icon, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
        {icon && (
          <span className="shrink-0 leading-none text-brand-500" aria-hidden>
            {icon}
          </span>
        )}
        {title}
      </h2>
      {action}
    </div>
  );
}
