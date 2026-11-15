/*
 * Admin panel class recipes: the brand system (Brand Book, Edition 2) in its
 * calm register. Shared by every page under pages/admin so the internal tool
 * reads as one system. Panels are <Card> / `.surface`; titles are
 * <PageHeader>; filters are `.seg`. These cover what the shared components
 * don't: native selects and textareas, list rows, the tray an expanded row
 * opens into, meta lines and inline links.
 */

/** Native input / select / textarea at admin density, matching <Input>. */
export const FIELD =
  'rounded-lg border-[1.5px] border-navy/25 bg-white px-3 py-2 text-sm font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400';

/** Hairlines between the rows of a list panel. */
export const ROWS = 'divide-y divide-gray-200 dark:divide-white/10';

/** Hover wash for a row you can open or act on. */
export const ROW_HOVER = 'transition-colors hover:bg-gray-50 dark:hover:bg-white/5';

/** The caps header strip across the top of a list panel. */
export const LIST_HEAD = 'eyebrow bg-gray-50 dark:bg-white/5';

/** The tray an expanded row opens into. */
export const TRAY = 'border-t border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.03]';

/** Meta line: dates, counts, emails. */
export const META = 'text-xs text-gray-500 dark:text-gray-400';

/** Inline text link. Ball Orange itself is too light for small text on white. */
export const LINK =
  'font-bold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300';

/** Native checkbox / radio, ticked in Ball Orange. */
export const CHECK = 'h-4 w-4 shrink-0 cursor-pointer accent-brand-500';

/** A `.seg` child that isn't the picked one (`seg-on` styles that). */
export const SEG_IDLE = 'whitespace-nowrap hover:bg-navy/5 dark:hover:bg-white/10';

/** Class for a `.seg` child. */
export function segItem(active: boolean): string {
  return active ? 'seg-on whitespace-nowrap' : SEG_IDLE;
}

/** A stat tile's number: the fat one, 24px (big numbers only). Add a colour. */
export const STAT_NUMBER = 'font-display text-2xl leading-tight tabular-nums';

/** Default ink for a stat number. */
export const STAT_INK = 'text-navy dark:text-biscuit';
