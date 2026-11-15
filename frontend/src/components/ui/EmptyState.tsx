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
 * The brand empty state: a doodle, one bold line, one plain line, one
 * button. Never a dead end.
 *
 * Doodle guide: sleeping = nothing here yet · sniffing = search/filter found
 * nothing · ball = success / liked · digging = error, 404 · howling = alerts.
 * Prefer `illustration`; `icon` remains for the few places without one and
 * should be a drawn icon, not an emoji.
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
      className={`rounded-2xl bg-white dark:bg-night-surface border border-gray-200 dark:border-white/10 py-9 px-6 text-center ${className}`}
    >
      {illustration ? (
        <PetIllustration
          name={illustration}
          species={species}
          className="mx-auto mb-3 h-28 w-auto"
        />
      ) : (
        icon && (
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-3xl leading-none text-navy dark:bg-brand-500/20 dark:text-brand-200" aria-hidden>
            {icon}
          </div>
        )
      )}
      <p className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit text-balance">{title}</p>
      {body && <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-snug text-balance max-w-xs mx-auto">{body}</div>}
      {action && <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">{action}</div>}
    </div>
  );
}
