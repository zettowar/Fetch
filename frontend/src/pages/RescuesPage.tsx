import { useState, useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listRescues, type RescuePublic } from '../api/rescues';
import BrandIcon from '../components/brand/BrandIcon';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import SearchInput from '../components/ui/SearchInput';
import { ListSkeleton } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import { useSectionOpen } from '../hooks/usePublicFlags';
import { useDocumentTitle } from '../utils/useDocumentTitle';

function RescueCard({ rescue }: { rescue: RescuePublic }) {
  // In-app checkout only exists while the Donate section is switched on;
  // with it off, fall back to the rescue's own donation page (or no button).
  const donateOpen = useSectionOpen('explore_donate_enabled');
  const inAppDonate = rescue.donations_enabled && donateOpen;
  // Stretched-link pattern: the detail Link is an overlay sibling of the
  // Donate/Website anchors rather than their parent — interactive elements
  // must never nest.
  return (
    <Card interactive className="relative">
      <Link
        to={`/app/rescues/${rescue.id}`}
        aria-label={`View ${rescue.org_name}`}
        className="absolute inset-0 rounded-2xl"
      />
      <div className="flex items-start gap-3">
        {/* The rescue's logo tile: Forever Pink leads on rescue surfaces. */}
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-navy bg-pink-500 text-navy dark:border-white/15"
          aria-hidden
        >
          {rescue.logo_url ? (
            <img src={rescue.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <BrandIcon name="rescue" size={24} style={{ '--bean': 'var(--paper)' } as CSSProperties} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-base font-extrabold text-navy dark:text-biscuit">{rescue.org_name}</h3>
            <Badge variant="success" icon={<BrandIcon name="shield" size={12} />}>
              Verified
            </Badge>
          </div>
          {rescue.location && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{rescue.location}</p>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{rescue.description}</p>
      {(rescue.website || rescue.donation_url || inAppDonate) && (
        <div className="relative flex items-center gap-2 mt-3">
          {inAppDonate ? (
            <Link to={`/app/donate?rescue=${rescue.id}`} className="btn btn-rescue btn-sm">
              Donate
            </Link>
          ) : rescue.donation_url ? (
            <a
              href={rescue.donation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-rescue btn-sm"
            >
              Donate
            </a>
          ) : null}
          {rescue.website && (
            <a
              href={rescue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              Website
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

type Kind = 'all' | 'donating' | 'has_website';

// The one measure every band lines up on from `sm` (inert on a phone):
// centred, capped like the app's wide pages, with its own side padding so
// the full-bleed header and count bands can hold it too.
const COLUMN = 'sm:mx-auto sm:w-full sm:max-w-6xl sm:px-6';

export default function RescuesPage() {
  useDocumentTitle('Browse rescues · Fetchpawz');
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
      if (filter === 'donating' && !r.donation_url && !r.donations_enabled) return false;
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
    // A list with no map, filling the pane beside the rail. From `sm` the
    // header, count line and cards share one centred measure (COLUMN) so a
    // 1600px pane doesn't stretch rows edge to edge; from `md` the cards
    // tile into a grid. The bands themselves stay full-bleed.
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Compact header ──────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-night-surface sm:px-0 sm:pt-4 sm:pb-3">
        <div className={COLUMN}>
        <h1 className="text-[28px] leading-none text-navy dark:text-biscuit flex items-center gap-2">
          <BrandIcon name="rescue" size={24} /> Rescues
        </h1>

        <SearchInput
          className="mt-2.5 sm:max-w-xl"
          value={search}
          onChange={setSearch}
          placeholder="Search rescues by name or location..."
        />

        {/* Phone: one scrolling row bleeding to the edges. With room, the
            chips just sit on the line. */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto -mx-4 px-4 pb-0.5 sm:mx-0 sm:px-0 sm:flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`chip flex-shrink-0 ${filter === opt.key ? 'chip-on' : 'hover:bg-gray-50 dark:hover:bg-night-surface'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* ── List pane ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-biscuit dark:bg-night">
        <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 bg-biscuit dark:bg-night border-b border-gray-200 dark:border-white/10 sticky top-0 z-10 sm:px-0">
          <span className={COLUMN}>
            {filtered.length} {filtered.length === 1 ? 'rescue' : 'rescues'}
            {search && rescues.length !== filtered.length && ` · ${rescues.length - filtered.length} filtered`}
          </span>
        </div>

        {isLoading ? (
          <div className={`p-4 ${COLUMN}`}>
            <ListSkeleton rows={4} />
          </div>
        ) : isError ? (
          <ErrorState message="Couldn't load rescues." onRetry={() => refetch()} />
        ) : filtered.length === 0 ? (
          <div className={`p-4 ${COLUMN}`}>
            {search ? (
              <EmptyState illustration="sniffing" title={`No results for "${search}"`} />
            ) : filter !== 'all' ? (
              // A filter with no matches is not an empty directory.
              <EmptyState
                illustration="sniffing"
                title="No rescues match that filter"
                action={
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFilter('all')}>
                    Show all rescues
                  </button>
                }
              />
            ) : (
              <EmptyState
                illustration="sleeping"
                title="No verified rescues yet"
                body="Check back soon."
              />
            )}
          </div>
        ) : (
          <div className={`p-4 flex flex-col gap-3 sm:py-5 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3 ${COLUMN}`}>
            {filtered.map((r) => (
              <RescueCard key={r.id} rescue={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
