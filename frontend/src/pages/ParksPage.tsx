import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Trees } from 'lucide-react';
import { getNearbyParks } from '../api/parks';
import Map from '../components/Map';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import SearchInput from '../components/ui/SearchInput';
import { ListSkeleton } from '../components/ui/Skeleton';
import PawSpinner from '../components/flair/PawSpinner';
import { useUserLocation } from '../utils/useUserLocation';

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749]; // fallback

type Filter = 'all' | 'active' | 'verified';

export default function ParksPage() {
  const initialCenter = useUserLocation(DEFAULT_CENTER);
  const [viewCenter, setViewCenter] = useState<[number, number]>(initialCenter);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);
  const listRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const navigate = useNavigate();

  // Sync the query center when the user-location hook resolves.
  useEffect(() => {
    setViewCenter(initialCenter);
  }, [initialCenter[0], initialCenter[1]]);

  const { data: parks = [], isLoading, isError } = useQuery({
    queryKey: ['parks-nearby', viewCenter[1], viewCenter[0]],
    queryFn: () => getNearbyParks(viewCenter[1], viewCenter[0], 25),
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
    color: p.active_pets_count > 0 ? '#f97316' : p.verified ? '#22c55e' : '#9ca3af',
    label: p.name,
    onClick: () => setSelectedParkId(p.id),
    popup: (
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-gray-900 dark:text-gray-100 leading-tight">{p.name}</p>
        {p.address && <p className="text-xs text-gray-500 dark:text-gray-400">{p.address}</p>}
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
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {p.avg_rating.toFixed(1)} ★ · {p.review_count} {p.review_count === 1 ? 'review' : 'reviews'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/app/parks/${p.id}`)}
          className="mt-2 w-full rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium py-1.5 transition-colors"
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
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Trees size={20} aria-hidden className="text-brand-500" /> Pet Parks
        </h1>

        <SearchInput
          className="mt-2.5"
          value={search}
          onChange={setSearch}
          placeholder="Search parks by name or address..."
        />

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
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 glass rounded-full px-4 py-2 shadow-soft-lg">
              <PawSpinner size="sm" />
            </div>
          )}
          {/* Map legend */}
          <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-white/95 dark:bg-gray-900/90 px-2.5 py-1.5 text-2xs text-gray-700 dark:text-gray-200 shadow-soft ring-1 ring-black/5 dark:ring-white/10 backdrop-blur z-10">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-500" />
              Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-success-500" />
              Verified
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />
              Unverified
            </span>
          </div>
        </div>

        {/* ── List pane ───────────────────────────────────────────── */}
        <div className="overflow-y-auto overscroll-contain flex-1 bg-gray-50 dark:bg-gray-800/50">
          <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
            <span>
              {filteredParks.length} {filteredParks.length === 1 ? 'park' : 'parks'}
              {search && parks.length !== filteredParks.length && ` · ${parks.length - filteredParks.length} filtered`}
            </span>
            {selectedParkId && (
              <button
                onClick={() => setSelectedParkId(null)}
                className="text-brand-500 hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>

          <div className="p-3">
            {isLoading ? (
              <ListSkeleton rows={4} />
            ) : isError ? (
              <p className="text-danger-500 dark:text-danger-400 text-sm text-center py-6">
                Failed to load parks. Check your connection.
              </p>
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
                    <>
                      Parks come from{' '}
                      <a
                        href="https://wiki.openstreetmap.org/wiki/Tag:leisure%3Ddog_park"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-500 hover:underline"
                      >
                        OpenStreetMap
                      </a>
                      . Missing one? Add it there and it'll show up on the next sync.
                    </>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-2">
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
                      className={`block p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-white dark:bg-gray-900 border-brand-300 dark:border-brand-500/50 ring-2 ring-brand-200 dark:ring-brand-500/30 shadow-sm'
                          : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-brand-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">
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
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{park.address}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {park.avg_rating ? (
                            <>
                              <p className="text-sm text-yellow-400 tracking-tight leading-none">
                                {'★'.repeat(Math.round(park.avg_rating))}
                                <span className="text-gray-200">
                                  {'★'.repeat(5 - Math.round(park.avg_rating))}
                                </span>
                              </p>
                              <p className="text-2xs text-gray-400 dark:text-gray-500 mt-0.5">
                                {park.avg_rating.toFixed(1)} · {park.review_count}
                              </p>
                            </>
                          ) : (
                            <p className="text-2xs text-gray-400 dark:text-gray-500">No reviews</p>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <p className="text-2xs text-brand-600 mt-2 font-medium">
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
