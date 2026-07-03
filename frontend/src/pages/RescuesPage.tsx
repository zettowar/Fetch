import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listRescues, type RescuePublic } from '../api/rescues';
import { Spinner } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';

function RescueCard({ rescue }: { rescue: RescuePublic }) {
  // Stretched-link pattern: the detail Link is an overlay sibling of the
  // Donate/Website anchors rather than their parent — interactive elements
  // must never nest.
  return (
    <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 hover:border-brand-200 dark:hover:border-brand-500/40 transition-colors">
      <Link
        to={`/app/rescues/${rescue.id}`}
        aria-label={`View ${rescue.org_name}`}
        className="absolute inset-0 rounded-2xl"
      />
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{rescue.org_name}</h3>
        <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
          Verified
        </span>
      </div>
      {rescue.location && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{rescue.location}</p>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{rescue.description}</p>
      {(rescue.website || rescue.donation_url) && (
        <div className="relative flex items-center gap-2 mt-3">
          {rescue.donation_url && (
            <a
              href={rescue.donation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              Donate
            </a>
          )}
          {rescue.website && (
            <a
              href={rescue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              Website
            </a>
          )}
        </div>
      )}
    </div>
  );
}

type Kind = 'all' | 'donating' | 'has_website';

export default function RescuesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Kind>('all');
  const { data: rescues = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['rescues'],
    queryFn: () => listRescues(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rescues.filter((r) => {
      if (q && !(r.org_name.toLowerCase().includes(q) || (r.location ?? '').toLowerCase().includes(q))) {
        return false;
      }
      if (filter === 'donating' && !r.donation_url) return false;
      if (filter === 'has_website' && !r.website) return false;
      return true;
    });
  }, [rescues, search, filter]);

  const filterOptions: { key: Kind; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'donating', label: 'Accepting donations' },
    { key: 'has_website', label: 'Has website' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Compact header ──────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <span aria-hidden>🏠</span> Rescues
          </h1>
          <Link
            to="/signup-rescue"
            className="text-xs font-medium text-brand-500 hover:text-brand-600 whitespace-nowrap"
          >
            Are you a rescue?
          </Link>
        </div>

        <div className="relative mt-2.5">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle cx={11} cy={11} r={7} strokeWidth={2} />
            <path d="m20 20-3-3" strokeWidth={2} strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rescues by name or location..."
            className="w-full bg-gray-100 dark:bg-gray-800 rounded-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-brand-300"
          />
        </div>

        <div className="flex gap-1.5 mt-2 overflow-x-auto -mx-4 px-4 pb-0.5">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === opt.key
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── List pane ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 dark:bg-gray-800/40">
        <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
          <span>
            {filtered.length} {filtered.length === 1 ? 'rescue' : 'rescues'}
            {search && rescues.length !== filtered.length && ` · ${rescues.length - filtered.length} filtered`}
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        ) : isError ? (
          <ErrorState message="Couldn't load rescues." onRetry={() => refetch()} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6 text-gray-400 dark:text-gray-500">
            {search ? (
              <>
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-medium">No results for "{search}"</p>
              </>
            ) : (
              <>
                <p className="text-4xl mb-3">🏠</p>
                <p className="font-medium">No verified rescues yet</p>
                <p className="text-sm mt-1">Check back soon.</p>
              </>
            )}
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3">
            {filtered.map((r) => (
              <RescueCard key={r.id} rescue={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
