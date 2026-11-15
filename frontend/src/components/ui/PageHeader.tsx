import type { ReactNode } from 'react';
import BackButton from './BackButton';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  back?: boolean;
  backFallback?: string;
  action?: ReactNode;
  className?: string;
  /**
   * The calm register: set the title in plain Figtree instead of Bagel Fat
   * One. For Lost & Found, account security and anything else where worry
   * gets plain type.
   */
  plain?: boolean;
}

/**
 * The one page-title pattern for /app pages: one title per screen, Bagel Fat
 * One at 28px top left (or plain Figtree in the calm register), optional
 * subtitle, optional BackButton above, optional right-aligned action.
 */
export default function PageHeader({
  title,
  subtitle,
  back = false,
  backFallback,
  action,
  className = '',
  plain = false,
}: PageHeaderProps) {
  return (
    <header className={className}>
      {back && <BackButton fallback={backFallback} />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            className={`${plain ? 'font-plain text-[26px] leading-tight' : 'text-[28px] leading-none'} text-navy dark:text-biscuit text-balance`}
          >
            {title}
          </h1>
          {subtitle && (
            <div className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">{subtitle}</div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
