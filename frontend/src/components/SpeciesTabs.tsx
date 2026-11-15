import { useSpeciesFilter, type SpeciesFilter } from '../hooks/useSpeciesFilter';

const OPTIONS: { value: SpeciesFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'dog', label: 'Dogs' },
  { value: 'cat', label: 'Cats' },
];

/**
 * Segmented species control backed by the shared species filter.
 * `hideAll` drops the "All" (mixed) option — used on Home, where a "both"-species
 * user picks one species at a time (no dual view). With "All" hidden, a mixed
 * filter value reads as the first species so a tab is always active.
 */
export default function SpeciesTabs({
  className = '',
  hideAll = false,
}: {
  className?: string;
  hideAll?: boolean;
}) {
  const [filter, setFilter] = useSpeciesFilter();
  const options = hideAll ? OPTIONS.filter((o) => o.value !== 'all') : OPTIONS;
  const active: SpeciesFilter = hideAll && filter === 'all' ? 'dog' : filter;
  return (
    <div
      role="tablist"
      aria-label="Filter by species"
      // `.seg` paints the selected tab (aria-selected) in Ball Orange.
      className={`seg ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={active === o.value}
          onClick={() => setFilter(o.value)}
          className={`px-4 ${active === o.value ? 'seg-on' : 'hover:bg-navy/5 dark:hover:bg-white/10'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
