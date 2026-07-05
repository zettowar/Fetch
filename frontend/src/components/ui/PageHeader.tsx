import type { ReactNode } from 'react';
import BackButton from './BackButton';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  back?: boolean;
  backFallback?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * The one page-title pattern for /app pages: consistent h1 size, optional
 * subtitle, optional BackButton above, optional right-aligned action.
 */
export default function PageHeader({
  title,
  subtitle,
  back = false,
  backFallback,
  action,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={className}>
      {back && <BackButton fallback={backFallback} />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
