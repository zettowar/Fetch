import type { CSSProperties } from 'react';
import { ACCENTS, type AccentName } from './accents';

export type { AccentName };

/**
 * An accent mark (Brand Book, Shapes → Accent marks): sparkle = a win,
 * burst = a tap landed, zoom = speed, heart = a like, zzz = nothing yet,
 * arcs = a sound, squiggle = excitement, tail = the end of a thought.
 * Decorative only. Three at most per composition; never in Lost & Found.
 */
export default function Accent({
  name,
  className = '',
  style,
}: {
  name: AccentName;
  className?: string;
  style?: CSSProperties;
}) {
  const a = ACCENTS[name];
  return (
    <svg
      viewBox={a.viewBox}
      className={`pointer-events-none shrink-0 overflow-visible ${className}`}
      style={style}
      aria-hidden
      focusable={false}
      // Static, code-owned artwork generated from the brand book.
      dangerouslySetInnerHTML={{ __html: a.svg }}
    />
  );
}
