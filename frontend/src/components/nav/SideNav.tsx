import type React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../store/AuthContext';
import { usePublicFlags } from '../../hooks/usePublicFlags';
import { DESKTOP_UP, useMediaQuery } from '../../hooks/useMediaQuery';
import BrandIcon, { type BrandIconName } from '../brand/BrandIcon';
import { TabItem } from './TabBar';
import {
  DESKTOP_MORE_NAV,
  EXPLORE_ITEMS,
  isWithin,
  primaryNav,
  useActiveNavPath,
} from './navConfig';

interface Props {
  exploreOpen: boolean;
  onToggleExplore: () => void;
}

/**
 * Navigation from `sm` up, where the bottom tab bar gives way:
 *
 * - **Tablet (sm–lg): the rail.** The tab bar turned on its side — the same
 *   stacked icon-and-label items in an 88px column. Explore still opens the
 *   sheet (a centred dialog at this size).
 * - **Desktop (lg+): the sidebar.** Labelled rows, with Explore's six doors
 *   listed in place rather than behind a sheet, and the profile-menu
 *   destinations a phone reaches through Profile.
 *
 * Sticky under the 56px top bar; it scrolls on its own if a short window
 * can't fit it.
 */
export default function SideNav({ exploreOpen, onToggleExplore }: Props) {
  const isDesktop = useMediaQuery(DESKTOP_UP);
  return (
    <aside
      className="hidden sm:flex sticky top-14 self-start h-[calc(100dvh-3.5rem)] shrink-0 flex-col overflow-y-auto overscroll-contain scrollbar-none border-r border-navy/10 bg-white/70 dark:border-white/10 dark:bg-night-surface/60 w-[88px] lg:w-60"
    >
      {isDesktop ? (
        <Sidebar />
      ) : (
        <Rail exploreOpen={exploreOpen} onToggleExplore={onToggleExplore} />
      )}
    </aside>
  );
}

function Rail({ exploreOpen, onToggleExplore }: Props) {
  const { user } = useAuth();
  const flags = usePublicFlags();
  const items = primaryNav(user);
  const activePath = useActiveNavPath(items);
  return (
    // Spacing sized so all five items fit a landscape phone (390px tall,
    // 334px under the top bar) without the rail scrolling.
    <nav aria-label="Main" className="flex flex-col items-stretch gap-1.5 px-1.5 py-3">
      {items.map((item) => (
        <TabItem
          key={item.path}
          item={item}
          active={activePath === item.path}
          exploreDisabled={!!item.isSheet && !flags.explore_enabled}
          exploreOpen={exploreOpen}
          onToggleExplore={onToggleExplore}
          layoutId="rail-indicator"
          className="w-full rounded-2xl"
        />
      ))}
    </nav>
  );
}

function Sidebar() {
  const { user } = useAuth();
  const flags = usePublicFlags();
  const { pathname } = useLocation();
  const isRescue = user?.role === 'rescue';
  // The sheet entry has no place here: its destinations are listed below.
  const items = primaryNav(user).filter((item) => !item.isSheet);
  const activePath = useActiveNavPath(items);
  const activeExplore = EXPLORE_ITEMS.find((item) => isWithin(pathname, item.to))?.to;
  const activeMore = DESKTOP_MORE_NAV.find((item) => isWithin(pathname, item.path))?.path;

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-3 py-5">
      {items.map((item) => (
        <SideRow
          key={item.path}
          to={item.path}
          label={item.label}
          icon={item.icon}
          active={activePath === item.path}
        />
      ))}

      {!isRescue && (
        <>
          <SideGroup title="Explore" />
          {!flags.explore_enabled ? (
            <SideRow label="Explore" icon="explore" soon />
          ) : (
            EXPLORE_ITEMS.map((item) => (
              <SideRow
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                active={activeExplore === item.to}
                soon={!flags[item.flagKey]}
              />
            ))
          )}

          <SideGroup title="You" />
          {DESKTOP_MORE_NAV.map((item) => (
            <SideRow
              key={item.path}
              to={item.path}
              label={item.label}
              icon={item.icon}
              active={activeMore === item.path}
            />
          ))}
        </>
      )}
    </nav>
  );
}

function SideGroup({ title }: { title: string }) {
  return <p className="eyebrow mt-5 mb-1.5 px-3">{title}</p>;
}

interface SideRowProps {
  to?: string;
  label: string;
  icon: BrandIconName;
  active?: boolean;
  /** Switched off by an admin flag: greyed, not a link. */
  soon?: boolean;
}

/** One sidebar row. The current page gets the same orange pill as the tab
 *  bar, stretched to the row: navy line, navy ink, white bean. */
function SideRow({ to, label, icon, active = false, soon = false }: SideRowProps) {
  const base =
    'relative flex min-h-[42px] items-center gap-3 rounded-full px-3 text-[15px] transition-colors duration-150 ease-soft-out';

  if (soon || !to) {
    return (
      <div
        aria-disabled
        title="Coming soon"
        className={`${base} cursor-not-allowed font-bold text-gray-400 dark:text-gray-500`}
      >
        <BrandIcon name={icon} size={22} style={{ '--bean': 'currentColor' } as React.CSSProperties} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-2xs font-extrabold uppercase tracking-[0.08em]">Soon</span>
      </div>
    );
  }

  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`${base} ${
        active
          ? 'font-extrabold text-navy'
          : 'font-bold text-gray-600 hover:bg-navy/[0.06] hover:text-navy dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-biscuit'
      }`}
    >
      {active && (
        <motion.span
          layoutId="side-indicator"
          className="absolute inset-0 rounded-full border-2 border-navy bg-brand-500 dark:border-transparent"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <BrandIcon
        name={icon}
        size={22}
        className="relative"
        style={{ '--bean': active ? '#FFFFFF' : 'currentColor' } as React.CSSProperties}
      />
      <span className="relative min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}
