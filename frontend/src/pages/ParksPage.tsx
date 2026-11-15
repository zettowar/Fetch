import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { getNearbyParks } from '../api/parks';
import Map, { MAP_PIN } from '../components/Map';
import Badge from '../components/ui/Badge';
import BrandIcon from '../components/brand/BrandIcon';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import SearchInput from '../components/ui/SearchInput';
import { ListSkeleton } from '../components/ui/Skeleton';
import PawSpinner from '../components/flair/PawSpinner';
import { DEFAULT_MAP_CENTER, useUserLocation } from '../utils/useUserLocation';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { useAuth } from '../store/AuthContext';

// Inline text link: navy ink on an orange underline.
const LINK =
  'font-bold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit';

type Filter = 'all' | 'active' | 'verified';

export default function ParksPage() {
  useDocumentTitle('Pet parks · Fetchpawz');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const initialCenter = useUserLocation(DEFAULT_MAP_CENTER);
  const [viewCenter, setViewCenter] = useState<[number, number]>(initialCenter);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);
  const listRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const navigate = useNavigate();

  // Sync the query center when the user-location hook resolves.
  useEffect(() => {
    setViewCenter(initialCenter);
  }, [initialCenter]);

  const { data: parks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['parks-nearby', viewCenter[1], viewCenter[0]],
    queryFn: () => getNearbyParks(viewCenter[1], viewCenter[0], 25),
    // Keep the last result on screen while the next centre loads. The key is
    // the exact map centre, so without this every pan was a brand-new query
    // with no data: the pins vanished (and any open popup closed) until the
    // response for the new position arrived.
    placeholderData: keepPreviousData,
  });

  const searchLower = search.trim().toLowerCase();
  const filteredParks = parks.filter((p) => {
    if (filter === 'active' && p.active_pets_count <= 0) return false;
    if (filter === 'verified' && !p.verified) return false;
    if (searchLower) {
      const name = p.name.toLowerCase();
      const addr = (p.address || '').toLowerCase();
      if (!name.includes(searchLower) && !addr.includes(searchLower)) return false;
    }
    return true;
  });

  // Drop stale selection if the filtered list no longer contains it.
  useEffect(() => {
    if (!selectedParkId) return;
    if (!filteredParks.find((p) => p.id === selectedParkId)) {
      setSelectedParkId(null);
    }
  }, [filteredParks, selectedParkId]);

  const markers = filteredParks.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    // Green is the park colour. Pets here now = an orange dot on the green
    // pin; unverified = an outline pin (white, green dot).
    color: p.active_pets_count > 0 || p.verified ? MAP_PIN.park : MAP_PIN.paper,
    dot: p.active_pets_count > 0 ? MAP_PIN.play : p.verified ? MAP_PIN.paper : MAP_PIN.park,
    label: p.name,
    onClick: () => setSelectedParkId(p.id),
    popup: (
      <div className="flex flex-col gap-1">
        <p className="text-base font-extrabold text-navy dark:text-biscuit leading-tight">{p.name}</p>
        {p.address && <p className="text-xs text-gray-600 dark:text-gray-300">{p.address}</p>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
          {p.active_pets_count > 0 && (
            <Badge
              variant="brand"
              icon={
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
                </span>
              }
            >
              {p.active_pets_count} here
            </Badge>
          )}
          {p.verified && p.active_pets_count === 0 && <Badge variant="success">Verified</Badge>}
          {p.avg_rating != null && (
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              {p.avg_rating.toFixed(1)} <span className="text-navy dark:text-biscuit">★</span> · {p.review_count} {p.review_count === 1 ? 'review' : 'reviews'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/app/parks/${p.id}`)}
          className="btn btn-secondary btn-sm mt-2 w-full"
        >
          View park
        </button>
      </div>
    ),
  }));

  // When a marker is selected (either via map click or list click), scroll the
  // matching list row into view and highlight it.
  useEffect(() => {
    if (!selectedParkId) return;
    const el = listRefs.current[selectedParkId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedParkId]);

  const filterOptions: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active now' },
    { key: 'verified', label: 'Verified' },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Compact header ──────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2.5 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-night-surface">
        <h1 className="text-2xl leading-none text-navy dark:text-biscuit flex items-center gap-2">
          <BrandIcon name="park" size={24} /> Pet parks
        </h1>

        <SearchInput
          className="mt-2.5"
          value={search}
          onChange={setSearch}
          placeholder="Search parks by name or address..."
        />

        <div className="mt-2.5 overflow-x-auto -mx-4 px-4 pb-0.5">
          <div className="seg">
            {filterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                aria-pressed={filter === opt.key}
                className="flex-shrink-0"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-[65%] min-h-[280px] relative">
          <Map
            center={initialCenter}
            zoom={12}
            markers={markers}
            showLocateMe
            selectedMarkerId={selectedParkId}
            onPopupClose={() => setSelectedParkId(null)}
            onViewChange={(lat, lng) => setViewCenter([lng, lat])}
            className="h-full w-full"
          />
          {isLoading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 glass rounded-full border border-gray-200 px-4 py-2 dark:border-white/10">
              <PawSpinner size="sm" />
            </div>
          )}
          {/* Map legend */}
          <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg border border-gray-200 bg-white/95 px-2.5 py-1.5 text-2xs font-bold text-navy backdrop-blur dark:border-white/10 dark:bg-night-surface/95 dark:text-biscuit z-10">
            {/* The pins in miniature. */}
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-navy bg-green-500 dark:border-biscuit/60">
                <span className="h-1 w-1 rounded-full bg-brand-500" />
              </span>
              Active
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-navy bg-green-500 dark:border-biscuit/60" />
              Verified
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-navy bg-white dark:border-biscuit/60">
                <span className="h-1 w-1 rounded-full bg-green-500" />
              </span>
              Unverified
            </span>
          </div>
        </div>

        {/* ── List pane ───────────────────────────────────────────── */}
        <div className="overflow-y-auto overscroll-contain flex-1 bg-biscuit dark:bg-night">
          <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-night-surface border-b border-gray-200 dark:border-white/10 sticky top-0 z-10">
            <span>
              {filteredParks.length} {filteredParks.length === 1 ? 'park' : 'parks'}
              {search && parks.length !== filteredParks.length && ` · ${parks.length - filteredParks.length} filtered`}
            </span>
            {selectedParkId && (
              <button
                onClick={() => setSelectedParkId(null)}
                className={LINK}
              >
                Clear selection
              </button>
            )}
          </div>

          <div className="p-3">
            {isLoading ? (
              <ListSkeleton rows={4} />
            ) : isError ? (
              <ErrorState message="Couldn't load parks." onRetry={() => refetch()} />
            ) : filteredParks.length === 0 ? (
              <EmptyState
                illustration="sniffing"
                title={
                  parks.length > 0
                    ? 'No parks match your search or filter.'
                    : "No parks in your area yet — we're expanding the library."
                }
                body={
                  parks.length === 0 ? (
                    // Adding a park is staff-only on the server. Offering the
                    // form to everyone meant filling it in to be told
                    // "Couldn't add the park. Try again.", so members get the same route Vets
                    // uses: tell us, and we add it.
                    isAdmin ? (
                      <>
                        Know one we&rsquo;re missing?{' '}
                        <Link to="/app/parks/new" className={LINK}>
                          Add a park
                        </Link>{' '}
                        and it will show up for everyone nearby.
                      </>
                    ) : (
                      <>
                        Know one we&rsquo;re missing?{' '}
                        <Link to="/app/support" className={LINK}>
                          Tell us
                        </Link>{' '}
                        and we&rsquo;ll add it for everyone nearby.
                      </>
                    )
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredParks.map((park) => {
                  const isSelected = selectedParkId === park.id;
                  return (
                    <Link
                      key={park.id}
                      ref={(el) => { listRefs.current[park.id] = el; }}
                      to={`/app/parks/${park.id}`}
                      onClick={(e) => {
                        // First tap: select + center map. Second tap: navigate.
                        if (!isSelected) {
                          e.preventDefault();
                          setSelectedParkId(park.id);
                        }
                      }}
                      // A thing you touch: navy line + toy shadow. Picked = orange tint.
                      className={`block p-3 rounded-2xl border-2 border-navy dark:border-white/15 transition-[transform,box-shadow,background-color] duration-150 ease-soft-out active:translate-x-[1px] active:translate-y-[2px] active:shadow-none ${
                        isSelected
                          ? 'bg-brand-50 dark:bg-brand-500/15 shadow-toy'
                          : 'bg-white dark:bg-night-surface shadow-toy-sm hover:-translate-y-px hover:shadow-toy'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-extrabold text-navy dark:text-biscuit leading-tight truncate">
                              {park.name}
                            </h3>
                            {park.verified && (
                              <Badge variant="success" title="Verified">
                                <Check size={10} strokeWidth={3} aria-hidden />
                              </Badge>
                            )}
                            {park.active_pets_count > 0 && (
                              <Badge
                                variant="brand"
                                icon={
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
                                  </span>
                                }
                              >
                                {park.active_pets_count} here
                              </Badge>
                            )}
                          </div>
                          {park.address && (
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 truncate">{park.address}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {park.avg_rating ? (
                            <>
                              {/* Navy ink, not gold: gold is earned only. */}
                              <p className="text-sm text-navy dark:text-biscuit tracking-tight leading-none">
                                {'★'.repeat(Math.round(park.avg_rating))}
                                <span className="text-gray-300 dark:text-white/20">
                                  {'★'.repeat(5 - Math.round(park.avg_rating))}
                                </span>
                              </p>
                              <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {park.avg_rating.toFixed(1)} · {park.review_count}
                              </p>
                            </>
                          ) : (
                            <p className="text-2xs text-gray-500 dark:text-gray-400">No reviews</p>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <p className="text-2xs text-navy dark:text-biscuit mt-2 font-extrabold">
                          Tap again to open →
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
