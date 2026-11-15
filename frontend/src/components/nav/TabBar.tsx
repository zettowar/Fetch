import { useCallback } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../store/AuthContext';
import { usePublicFlags } from '../../hooks/usePublicFlags';
import BrandIcon from '../brand/BrandIcon';
import { primaryNav, useActiveNavPath, type NavItem } from './navConfig';

interface Props {
  exploreOpen: boolean;
  onToggleExplore: () => void;
}

/**
 * The phone's bottom tab bar. Hidden from `sm` up, where the same items move
 * into the side rail (see SideNav).
 */
export default function TabBar({ exploreOpen, onToggleExplore }: Props) {
  const { user } = useAuth();
  const flags = usePublicFlags();
  const items = primaryNav(user);
  const activePath = useActiveNavPath(items);

  // Publish the tab bar's real rendered height (content + safe-area inset)
  // as --tab-bar-h on <html>, so layouts can reserve exactly that much space.
  // Measured, not hardcoded: AppShell's fixed-viewport screens, the toasts and
  // the impersonation banner all sit on this var. From `sm` up the bar is
  // display:none, the observer reports 0, and everything drops to the bottom
  // edge without a second code path.
  const tabBarRef = useCallback((el: HTMLDivElement | null) => {
    const root = document.documentElement;
    if (!el) {
      root.style.removeProperty('--tab-bar-h');
      return;
    }
    const update = () => root.style.setProperty('--tab-bar-h', `${el.offsetHeight}px`);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    // No explicit disconnect: the observer dies with the element, and the
    // callback ref runs with null on unmount to clear the property.
  }, []);

  return (
    <div
      ref={tabBarRef}
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-navy/10 dark:bg-night-surface/95 dark:border-white/10 safe-bottom sm:hidden"
    >
      <nav aria-label="Main" className="mx-auto max-w-app flex px-1 pt-1.5 pb-1.5">
        {items.map((item) => (
          <TabItem
            key={item.path}
            item={item}
            active={activePath === item.path}
            exploreDisabled={!!item.isSheet && !flags.explore_enabled}
            exploreOpen={exploreOpen}
            onToggleExplore={onToggleExplore}
            layoutId="tab-indicator"
          />
        ))}
      </nav>
    </div>
  );
}

interface TabItemProps {
  item: NavItem;
  active: boolean;
  exploreDisabled: boolean;
  exploreOpen: boolean;
  onToggleExplore: () => void;
  /** framer-motion layoutId for the sliding pill; unique per nav surface. */
  layoutId: string;
  className?: string;
}

/**
 * One stacked tab: icon in a pill over a label. Shared by the phone tab bar
 * and the tablet rail, which are the same object turned on its side.
 */
export function TabItem({
  item,
  active,
  exploreDisabled,
  exploreOpen,
  onToggleExplore,
  layoutId,
  className = 'flex-1',
}: TabItemProps) {
  const reduceMotion = useReducedMotion();
  const { path, label } = item;
  const displayLabel = exploreDisabled ? 'Soon' : label;
  // Labels always on. The current tab gets an orange pill behind its icon
  // (navy ink, white bean); the rest are muted navy with the bean in the
  // same ink.
  const itemClasses = `relative flex flex-col items-center gap-1 px-1 pt-1 pb-1 min-h-[54px] transition-colors duration-200 ease-soft-out ${className} ${
    exploreDisabled
      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
      : active
        ? 'text-navy dark:text-biscuit'
        : 'text-gray-500 dark:text-gray-400 hover:text-navy dark:hover:text-biscuit'
  }`;
  const content = (
    <>
      <span className="relative inline-flex h-8 w-14 items-center justify-center">
        {active && (
          <motion.span
            layoutId={layoutId}
            className="absolute inset-0 rounded-full border-2 border-navy bg-brand-500 dark:border-transparent"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
        )}
        {/* the wag when the tab becomes active */}
        <motion.span
          className={`relative leading-none ${active ? 'text-navy' : ''}`}
          style={{ '--bean': active ? '#FFFFFF' : 'currentColor' } as React.CSSProperties}
          animate={active && !reduceMotion ? { rotate: [0, -12, 9, -3, 0] } : { rotate: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <BrandIcon name={item.icon} size={24} />
        </motion.span>
      </span>
      <span
        className={`text-[11px] leading-none tracking-tight ${active ? 'font-extrabold' : 'font-bold'}`}
      >
        {displayLabel}
      </span>
    </>
  );

  if (item.isSheet) {
    return (
      <button
        type="button"
        onClick={exploreDisabled ? undefined : onToggleExplore}
        disabled={exploreDisabled}
        aria-label={exploreDisabled ? `${label} — coming soon` : label}
        aria-haspopup={exploreDisabled ? undefined : 'dialog'}
        aria-expanded={exploreDisabled ? undefined : exploreOpen}
        title={exploreDisabled ? 'Coming soon' : undefined}
        className={itemClasses}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={path}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={itemClasses}
    >
      {content}
    </Link>
  );
}
