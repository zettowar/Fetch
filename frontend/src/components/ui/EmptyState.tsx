import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Consistent empty-state block for list pages and sections.
 * - Centered with soft background card
 * - Optional leading emoji/icon
 * - Optional action (usually a Link wrapping a Button)
 */
export default function EmptyState({
  icon,
  title,
  body,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 py-10 px-6 text-center ${className}`}
    >
      {icon && (
        <div className="text-4xl mb-3 leading-none" aria-hidden>
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      {body && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{body}</div>}
      {action && <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">{action}</div>}
    </div>
  );
}
