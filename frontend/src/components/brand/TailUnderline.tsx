import type { ReactNode } from 'react';

/**
 * Underlines one phrase per headline — the one that carries the feeling —
 * with a line that ends in the tail and a bean (Brand Book, Shapes → The
 * tail). Never a whole line, never body text. The line takes the text colour;
 * on an orange ground pass `bean="#FFFFFF"` so the bean still shows.
 */
export default function TailUnderline({
  children,
  bean = 'var(--orange)',
}: {
  children: ReactNode;
  bean?: string;
}) {
  return (
    <span className="relative inline-block whitespace-nowrap pb-[0.16em] pr-[0.55em]">
      {children}
      <span aria-hidden className="absolute bottom-0 left-0 right-[0.95em] h-[0.075em] min-h-[2px] rounded-full bg-current" />
      <svg
        aria-hidden
        viewBox="0 0 60 44"
        className="absolute -bottom-[0.52em] right-0 h-[0.62em] w-[0.85em] overflow-visible"
      >
        <path
          d="M0 2.5H22C40 2.5 48 16 40 28c-3 5-9 6-13 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="27" cy="30" r="8" fill={bean} />
      </svg>
    </span>
  );
}
