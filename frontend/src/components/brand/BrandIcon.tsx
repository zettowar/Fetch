import type { CSSProperties } from 'react';
import { BRAND_ICONS, type BrandIconName } from './icons';

export type { BrandIconName };

/**
 * One of the 36 drawn icons (Brand Book, Icons chapter). Stroke is
 * `currentColor`; the bean is the feature's colour unless the parent sets
 * `--bean` (an active tab sets it to white, a navy button to orange).
 */
export default function BrandIcon({
  name,
  size = 24,
  className = '',
  title,
  style,
}: {
  name: BrandIconName;
  size?: number;
  className?: string;
  title?: string;
  style?: CSSProperties;
}) {
  const a11y = title
    ? ({ role: 'img', 'aria-label': title } as const)
    : ({ 'aria-hidden': true, focusable: false } as const);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={style}
      {...a11y}
      // Static, code-owned artwork generated from the brand book. The label
      // stays in aria-label (never interpolated into markup).
      dangerouslySetInnerHTML={{ __html: BRAND_ICONS[name] }}
    />
  );
}
