import type { ReactNode } from 'react';

const FILLS = {
  orange: 'bg-brand-500 text-navy',
  gold: 'bg-gold-500 text-navy',
  pink: 'bg-pink-500 text-navy',
  green: 'bg-green-500 text-navy',
  navy: 'bg-navy text-biscuit',
};

/**
 * A die-cut sticker (Brand Book, In use → Stickers): a fat Bagel word on a
 * colour pill with a white die-cut edge and a few degrees of tilt — never
 * straight. Stickers are objects, so they tilt; the one tilted thing on a
 * screen. Gold only for earned things, pink only for rescue.
 */
export default function Sticker({
  children,
  fill = 'orange',
  tilt = -4,
  className = '',
}: {
  children: ReactNode;
  fill?: keyof typeof FILLS;
  tilt?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-[3px] border-white px-3.5 pb-1.5 pt-1 font-display text-lg leading-none shadow-[0_6px_14px_-6px_rgba(17,19,46,0.45)] dark:border-night-raised ${FILLS[fill]} ${className}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {children}
    </span>
  );
}
