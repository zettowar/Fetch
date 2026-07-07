import type { ReactNode } from 'react';
import PetIllustration, { type IllustrationName } from '../flair/PetIllustration';
import type { Species } from '../../types';

interface EmptyStateProps {
  icon?: ReactNode;
  illustration?: IllustrationName;
  species?: Species;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Consistent empty-state block for list pages and sections.
 * - Centered with soft background card
 * - Optional pet illustration (preferred) or leading emoji/icon
 * - Optional action (usually a Link wrapping a Button)
 *
 * Illustration guide: sleeping = nothing here yet · sniffing = search/
 * filter found nothing · ball = liked/social · digging = lost & found /
 * error · howling = alerts.
 */
export default function EmptyState({
  icon,
  illustration,
  species = 'dog',
  title,
  body,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 py-10 px-6 text-center ${className}`}
    >
      {illustration ? (
        <PetIllustration
          name={illustration}
          species={species}
          className="mx-auto mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
        />
      ) : (
        icon && (
          <div className="text-4xl mb-3 leading-none" aria-hidden>
            {icon}
          </div>
        )
      )}
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      {body && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{body}</div>}
      {action && <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">{action}</div>}
    </div>
  );
}
