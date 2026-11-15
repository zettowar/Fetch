import type { ReactNode } from 'react';

/**
 * The tail rule (Brand Book, Shapes → The tail): one stroke that runs along,
 * drops, swings back and ends in a bean. It closes a thought. In the app it
 * closes the last section of a long page — once per view. An optional
 * sign-off sits above the line.
 */
export default function TailRule({
  children,
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-navy dark:text-biscuit ${className}`}>
      {children && (
        <p className="mb-2.5 font-display text-2xl leading-none text-navy dark:text-biscuit">{children}</p>
      )}
      <div className="flex items-start" aria-hidden>
        <i className="mt-px block h-[3px] flex-1 rounded-full bg-current" />
        <svg viewBox="0 0 60 44" className="-ml-0.5 h-[34px] w-[46px] shrink-0 overflow-visible">
          <path
            d="M0 2.5H22C40 2.5 48 16 40 28c-3 5-9 6-13 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="27" cy="30" r="6" fill="var(--orange)" />
        </svg>
      </div>
    </div>
  );
}
