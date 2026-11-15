import { useLocation } from 'react-router-dom';
import type { BrandIconName } from '../brand/BrandIcon';
import type { PublicFlags } from '../../api/publicSite';
import type { User } from '../../types';

/**
 * Where the app's navigation goes, shared by every surface that draws it: the
 * phone's bottom tab bar, the tablet's icon rail and the desktop sidebar. One
 * list, so the three layouts can never disagree about what the app contains.
 */

export const EXPLORE_SHEET = '__explore__';

export type NavItem = {
  path: string;
  label: string;
  /** A drawn brand icon (Brand Book, Icons → Tab bar). */
  icon: BrandIconName;
  /** Opens the Explore sheet instead of navigating. */
  isSheet?: boolean;
};

const CONSUMER_NAV: readonly NavItem[] = [
  { path: '/app/home', label: 'Home', icon: 'home' },
  { path: '/app/swipe', label: 'Swipe', icon: 'like' },
  { path: '/app/rescues', label: 'Rescues', icon: 'rescue' },
  { path: '/app/lost', label: 'Lost', icon: 'lost' },
  { path: EXPLORE_SHEET, label: 'Explore', icon: 'explore', isSheet: true },
];

/** Rescue accounts are a different product surface: no Swipe, no Explore. */
function rescueNav(userId: string): readonly NavItem[] {
  return [
    { path: '/app/rescue/dashboard', label: 'Dashboard', icon: 'rescue' },
    { path: '/app/pets/new', label: 'Post', icon: 'plus' },
    { path: '/app/lost', label: 'Lost', icon: 'lost' },
    { path: `/app/users/${userId}`, label: 'Profile', icon: 'user' },
  ];
}

export function primaryNav(user: User | null | undefined): readonly NavItem[] {
  return user?.role === 'rescue' ? rescueNav(user.id) : CONSUMER_NAV;
}

/**
 * The desktop sidebar has room the tab bar doesn't, so it also carries the
 * places a phone reaches through the profile menu. Consumers only.
 */
export const DESKTOP_MORE_NAV: readonly NavItem[] = [
  { path: '/app/rankings', label: 'Rankings', icon: 'crown' },
  { path: '/app/following', label: 'Following', icon: 'follow' },
  // Not the heart: Swipe wears it in the same sidebar.
  { path: '/app/liked', label: 'Liked', icon: 'star' },
  { path: '/app/support', label: 'Help', icon: 'help' },
];

export interface ExploreItem {
  label: string;
  description: string;
  icon: BrandIconName;
  to: string;
  featured?: boolean;
  /** Admin flag that gates this item; off => greyed "Soon". */
  flagKey: keyof PublicFlags;
}

export const EXPLORE_ITEMS: readonly ExploreItem[] = [
  {
    label: 'Parks',
    description: 'Check in, meet up',
    icon: 'park',
    to: '/app/parks',
    flagKey: 'explore_parks_enabled',
  },
  {
    label: 'The Pack',
    description: 'Pack+ perks',
    icon: 'lock',
    to: '/app/explore',
    featured: true,
    flagKey: 'explore_pack_enabled',
  },
  {
    label: 'Donate',
    description: 'Every bone counts',
    icon: 'donate',
    to: '/app/donate',
    flagKey: 'explore_donate_enabled',
  },
  {
    label: 'Shop',
    description: 'Gear for the walk',
    icon: 'bag',
    to: '/app/shop',
    flagKey: 'explore_shop_enabled',
  },
  {
    label: 'Community',
    description: 'Ask the pack',
    icon: 'chat',
    to: '/app/community',
    flagKey: 'explore_community_enabled',
  },
  {
    label: 'Vets',
    description: 'Near you',
    icon: 'vet',
    to: '/app/vets',
    flagKey: 'explore_vets_enabled',
  },
];

/** True when `pathname` is `path` or one of its subpages. The trailing slash
 *  keeps /app/rescues from lighting up for /app/rescues-something. */
export function isWithin(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * The nav entry the current page belongs to. Subpages keep their tab lit
 * (/app/rescues/browse → Rescues, /app/lost/:id → Lost); any Explore
 * destination lights the Explore tab.
 */
export function useActiveNavPath(items: readonly NavItem[]): string | undefined {
  const { pathname } = useLocation();
  const onExplore = EXPLORE_ITEMS.some((item) => isWithin(pathname, item.to));
  return items.find((item) =>
    item.isSheet ? onExplore : isWithin(pathname, item.path),
  )?.path;
}
