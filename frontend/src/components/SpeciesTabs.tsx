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
      className={`inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1 ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={active === o.value}
          onClick={() => setFilter(o.value)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active === o.value
              ? 'bg-white dark:bg-gray-900 text-brand-600 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
