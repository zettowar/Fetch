import { useSpeciesFilter, type SpeciesFilter } from '../hooks/useSpeciesFilter';

const OPTIONS: { value: SpeciesFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'dog', label: 'Dogs' },
  { value: 'cat', label: 'Cats' },
];

/** Segmented All / Dogs / Cats control backed by the shared species filter. */
export default function SpeciesTabs({ className = '' }: { className?: string }) {
  const [filter, setFilter] = useSpeciesFilter();
  return (
    <div
      role="tablist"
      aria-label="Filter by species"
      className={`inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1 ${className}`}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={filter === o.value}
          onClick={() => setFilter(o.value)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === o.value
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
