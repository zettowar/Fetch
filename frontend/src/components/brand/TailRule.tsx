import type { ReactNode } from 'react';
import TailStroke, { tailHeight } from './TailStroke';

const CURL_W = 46; // px

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
      {/* Tall enough for the curl, which hangs below the line. */}
      <div className="relative" style={{ height: tailHeight(CURL_W) }}>
        <TailStroke width={CURL_W} thickness={3} unit="px" beanRadius={6.5} bean="var(--orange)" className="top-0" />
      </div>
    </div>
  );
}
