import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getNearbyParks } from '../api/parks';
import Map from '../components/Map';
import { Spinner } from '../components/ui/Skeleton';

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];

type Filter = 'all' | 'active' | 'verified';

export default function ParksPage() {
  const [center] = useState(DEFAULT_CENTER);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);
  const listRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const navigate = useNavigate();

  const { data: parks = [], isLoading, isError } = useQuery({
    queryKey: ['parks-nearby', center[1], center[0]],
    queryFn: () => getNearbyParks(center[1], center[0], 25),
  });

  const searchLower = search.trim().toLowerCase();
  const filteredParks = parks.filter((p) => {
    if (filter === 'active' && p.active_dogs_count <= 0) return false;
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
    color: p.active_dogs_count > 0 ? '#f97316' : p.verified ? '#22c55e' : '#9ca3af',
    label: p.name,
    onClick: () => setSelectedParkId(p.id),
    popup: (
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-gray-900 leading-tight">{p.name}</p>
        {p.address && <p className="text-xs text-gray-500">{p.address}</p>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
          {p.active_dogs_count > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[11px] font-medium rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
              </span>
              {p.active_dogs_count} here
            </span>
          )}
          {p.verified && p.active_dogs_count === 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[11px] font-medium rounded-full">
              Verified
            </span>
          )}
          {p.avg_rating != null && (
            <span className="text-xs text-gray-500">
              {p.avg_rating.toFixed(1)} ★ · {p.review_count} {p.review_count === 1 ? 'review' : 'reviews'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/parks/${p.id}`)}
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
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Compact header ──────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-white">
        <h1 className="text-xl font-bold tracking-tight">Dog Parks</h1>

        <div className="relative mt-2.5">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
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
            placeholder="Search parks by name or address..."
            className="w-full bg-gray-100 rounded-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-300"
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
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Map (fixed 45% of remaining height) ─────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-[45%] min-h-[220px] relative">
          <Map
            center={center}
            zoom={12}
            markers={markers}
            fitMarkers
            showLocateMe
            selectedMarkerId={selectedParkId}
            onPopupClose={() => setSelectedParkId(null)}
            className="h-full w-full"
          />
          {/* Map legend */}
          <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] shadow-md ring-1 ring-black/5 backdrop-blur z-10">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" />
              Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
              Verified
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />
              Unverified
            </span>
          </div>
        </div>

        {/* ── List pane ───────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 bg-gray-50">
          <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500 bg-white border-b border-gray-100 sticky top-0 z-10">
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
              <div className="flex justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            ) : isError ? (
              <p className="text-red-500 text-sm text-center py-6">
                Failed to load parks. Check your connection.
              </p>
            ) : filteredParks.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">🌳</p>
                <p className="text-sm font-medium text-gray-500">
                  {parks.length > 0
                    ? 'No parks match your search or filter.'
                    : "No parks in your area yet — we're expanding the library."}
                </p>
                {parks.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">
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
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredParks.map((park) => {
                  const isSelected = selectedParkId === park.id;
                  return (
                    <Link
                      key={park.id}
                      ref={(el) => { listRefs.current[park.id] = el; }}
                      to={`/parks/${park.id}`}
                      onClick={(e) => {
                        // First tap: select + center map. Second tap: navigate.
                        if (!isSelected) {
                          e.preventDefault();
                          setSelectedParkId(park.id);
                        }
                      }}
                      className={`block p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-white border-brand-300 ring-2 ring-brand-200 shadow-sm'
                          : 'bg-white border-gray-100 hover:border-brand-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 leading-tight truncate">
                              {park.name}
                            </h3>
                            {park.verified && (
                              <span
                                className="inline-flex items-center text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full"
                                title="Verified"
                              >
                                ✓
                              </span>
                            )}
                            {park.active_dogs_count > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-medium rounded-full">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
                                </span>
                                {park.active_dogs_count} here
                              </span>
                            )}
                          </div>
                          {park.address && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{park.address}</p>
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
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {park.avg_rating.toFixed(1)} · {park.review_count}
                              </p>
                            </>
                          ) : (
                            <p className="text-[10px] text-gray-400">No reviews</p>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <p className="text-[11px] text-brand-600 mt-2 font-medium">
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
