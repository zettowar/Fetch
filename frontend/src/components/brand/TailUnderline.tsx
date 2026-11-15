import type { ReactNode } from 'react';
import TailStroke from './TailStroke';

/**
 * Underlines one phrase per headline — the one that carries the feeling —
 * with a line that ends in the tail and a bean (Brand Book, Shapes → The
 * tail). Never a whole line, never body text. The line takes the text colour;
 * on an orange ground pass `bean="#FFFFFF"` so the bean still shows.
 *
 * Measured in em, so it scales with the headline. The right padding leaves
 * room for the curl to swing out past the last letter.
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
      <TailStroke width={0.85} thickness={0.075} unit="em" beanRadius={8} bean={bean} className="bottom-0" />
    </span>
  );
}
