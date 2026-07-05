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
 * The canonical surface: white/gray-900, rounded-2xl, hairline border,
 * soft shadow. `interactive` adds the standard hover-lift + press-scale
 * for tappable cards; pass `as={Link}` to make the whole card a link.
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
      className={`block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft-sm overflow-hidden ${PADDINGS[padding]} ${
        interactive
          ? 'transition-all duration-200 ease-soft-out hover:shadow-soft hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] cursor-pointer'
          : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
