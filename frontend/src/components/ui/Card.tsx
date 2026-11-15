import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

const PADDINGS = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

type CardOwnProps<T extends ElementType> = {
  as?: T;
  padding?: keyof typeof PADDINGS;
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
};

type CardProps<T extends ElementType> = CardOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps<T>>;

/**
 * The canonical surface: white (Night Surface after dark), 20px corners and a
 * hairline. `interactive` turns it into a thing you can touch — a 2px Leash
 * Navy line and the toy shadow, pressing down onto it — per the brand rule
 * that objects get the outline and panels stay flat. Pass `as={Link}` to
 * make the whole card a link.
 */
export default function Card<T extends ElementType = 'div'>({
  as,
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}: CardProps<T>) {
  const Tag = (as ?? 'div') as ElementType;
  return (
    <Tag
      className={`block bg-white dark:bg-night-surface rounded-2xl overflow-hidden ${PADDINGS[padding]} ${
        interactive
          ? 'border-2 border-navy shadow-toy-sm dark:border-white/15 transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px hover:shadow-toy active:translate-x-[2px] active:translate-y-[3px] active:shadow-none cursor-pointer'
          : 'border border-gray-200 dark:border-white/10'
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
