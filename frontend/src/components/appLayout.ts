import { matchPath } from 'react-router-dom';

/*
 * How each /app route is laid out once the window is bigger than a phone.
 * AppShell reads these; they live apart so the rules can be tested.
 */

/**
 * Fixed-viewport screens: map/list split panes that own ALL scrolling
 * internally (map pans, list pane scrolls). For these the document itself
 * must not scroll — the old `h-[calc(100vh-56px)]` page height plus the
 * shell's `pb-20` left ~80px of body overflow (more on iOS, where 100vh is
 * the URL-bar-collapsed viewport), so vertical swipes were ambiguous between
 * body, map, and list. Exact-match paths; detail pages under them scroll
 * normally. From `md` up these pages put the list beside the map.
 */
export const FIXED_VIEWPORT_PATHS = new Set([
  '/app/lost',
  '/app/parks',
  '/app/vets',
  '/app/rescues/browse',
  '/app/rescues/map',
]);

/**
 * How wide a page may grow once there is room (`sm` and up). Below `sm` every
 * page is the 420px column whatever it says here.
 *
 * - `column` (the default) — one readable column, 672px: forms, settings,
 *   threads, lists of rows. A form stretched to 1100px is harder to use.
 * - `wide` — up to 1152px, for pages that lay out in columns or grids on a
 *   big screen (dashboards, pet grids, detail pages with a photo beside the
 *   facts). These pages own their responsive grid classes.
 *
 * A page added to `/app` lands in `column` until it is listed here, which is
 * the safe failure: narrow and readable, never stretched.
 */
export const WIDE_PAGES = [
  '/app/home',
  '/app/pets',
  '/app/pets/:id',
  '/app/liked',
  '/app/following',
  '/app/rankings',
  '/app/users/:id',
  '/app/explore',
  '/app/rescues',
  '/app/rescues/:id',
  '/app/rescue/dashboard',
  '/app/shop',
  '/app/shop/:handle',
  '/app/cart',
  '/app/donate',
  '/app/lost/:id',
  '/app/parks/:id',
  '/app/vets/:id',
  '/app/community',
];

/** Forms that sit under a wide page's path (`/app/pets/new` matches
 *  `/app/pets/:id`). Checked first. */
export const COLUMN_PAGES = [
  '/app/pets/new',
  '/app/parks/new',
  '/app/lost/report-missing',
  '/app/lost/report-found',
];

export const PAGE_WIDTH = {
  column: 'sm:max-w-2xl',
  wide: 'sm:max-w-none lg:max-w-6xl',
} as const;

export function pageWidthFor(pathname: string): keyof typeof PAGE_WIDTH {
  const matches = (pattern: string) => matchPath(pattern, pathname) !== null;
  if (COLUMN_PAGES.some(matches)) return 'column';
  return WIDE_PAGES.some(matches) ? 'wide' : 'column';
}

export function isFixedViewport(path: string): boolean {
  return FIXED_VIEWPORT_PATHS.has(path);
}
