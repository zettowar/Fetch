import type React from 'react';
import { DOODLES } from './doodles';

export type DogIllustrationName = 'sleeping' | 'digging' | 'ball' | 'sniffing' | 'howling';

interface DogIllustrationProps {
  name: DogIllustrationName;
  className?: string;
  title?: string;
}

/**
 * The dog doodles (Brand Book, The cast → Doodles): filled silhouettes with a
 * real 5px pen line, for the app's quiet moments.
 *   sleeping = nothing here yet · ball = success · sniffing = no results ·
 *   digging = errors, 404 · howling = alerts
 * The pen is always Leash Navy (Biscuit after dark) and the fur is a tint,
 * whatever text colour the caller's className carries — a filled drawing needs
 * a real line, never grey.
 */
export default function DogIllustration({ name, className = 'h-32 w-auto', title }: DogIllustrationProps) {
  return <Doodle species="dog" name={name} className={className} title={title} />;
}

export function Doodle({
  species,
  name,
  className = 'h-32 w-auto',
  title,
}: {
  species: 'dog' | 'cat';
  name: DogIllustrationName;
  className?: string;
  title?: string;
}) {
  const a11y = title
    ? ({ role: 'img', 'aria-label': title } as const)
    : ({ 'aria-hidden': true, focusable: false } as const);
  return (
    <svg
      viewBox="0 0 200 160"
      xmlns="http://www.w3.org/2000/svg"
      className={`doodle doodle-${name} ${className}`}
      style={
        {
          color: 'var(--pen)',
          '--fur': species === 'cat' ? 'var(--fur-cat)' : 'var(--fur-dog)',
        } as React.CSSProperties
      }
      {...a11y}
      // Static, code-owned artwork generated from the brand book.
      dangerouslySetInnerHTML={{ __html: DOODLES[species][name] }}
    />
  );
}
