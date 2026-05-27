import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getNearbyVets } from '../api/vets';
import Map from '../components/Map';
import { Spinner } from '../components/ui/Skeleton';
import { useUserLocation } from '../utils/useUserLocation';

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749]; // SF fallback
const VET_PIN_COLOR = '#0ea5e9'; // sky-500 — distinct from parks (orange/green) and rescues (violet)
const VET_PIN_EMERGENCY = '#ef4444'; // red — emergency clinics stand out

type Filter = 'all' | 'emergency' | 'open_24_7';

export default function VetsPage() {
  const initialCenter = useUserLocation(DEFAULT_CENTER);
  const [viewCenter, setViewCenter] = useState<[number, number]>(initialCenter);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedVetId, setSelectedVetId] = useState<string | null>(null);
  const listRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const navigate = useNavigate();

  useEffect(() => {
    setViewCenter(initialCenter);
  }, [initialCenter[0], initialCenter[1]]);

  const { data: vets = [], isLoading, isError } = useQuery({
    queryKey: ['vets-nearby', viewCenter[1], viewCenter[0]],
    queryFn: () => getNearbyVets(viewCenter[1], viewCenter[0], 30),
  });

  const searchLower = search.trim().toLowerCase();
  const filteredVets = vets.filter((v) => {
    if (filter === 'emergency' && !v.attributes?.emergency) return false;
    if (filter === 'open_24_7' && !v.attributes?.open_24_7) return false;
    if (searchLower) {
      const name = v.name.toLowerCase();
      const addr = (v.address || '').toLowerCase();
      if (!name.includes(searchLower) && !addr.includes(searchLower)) return false;
    }
    return true;
  });

  useEffect(() => {
    if (!selectedVetId) return;
    if (!filteredVets.find((v) => v.id === selectedVetId)) {
      setSelectedVetId(null);
    }
  }, [filteredVets, selectedVetId]);

  const markers = filteredVets.map((v) => ({
    id: v.id,
    lat: v.lat,
    lng: v.lng,
    color: v.attributes?.emergency ? VET_PIN_EMERGENCY : VET_PIN_COLOR,
    label: v.name,
    onClick: () => setSelectedVetId(v.id),
    popup: (
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-gray-900 dark:text-gray-100 leading-tight">{v.name}</p>
        {v.address && <p className="text-xs text-gray-500 dark:text-gray-400">{v.address}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {v.attributes?.emergency && (
            <span className="inline-flex items-center px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 text-[10px] font-semibold rounded-full">
              Emergency
            </span>
          )}
          {v.attributes?.open_24_7 && (
            <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 text-[10px] font-semibold rounded-full">
              24/7
            </span>
          )}
          {v.attributes?.house_calls && (
            <span className="inline-flex items-center px-1.5 py-0.5 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 text-[10px] font-semibold rounded-full">
              House calls
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/vets/${v.id}`)}
          className="mt-2 w-full rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium py-1.5 transition-colors"
        >
          View clinic
        </button>
      </div>
    ),
  }));

  useEffect(() => {
    if (!selectedVetId) return;
    const el = listRefs.current[selectedVetId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedVetId]);

  const filterOptions: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'emergency', label: 'Emergency' },
    { key: 'open_24_7', label: '24/7' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <span aria-hidden>🩺</span> Vets
        </h1>

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
            placeholder="Search vets by name or address..."
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

      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-[62%] min-h-[280px] relative">
          <Map
            center={initialCenter}
            zoom={12}
            markers={markers}
            showLocateMe
            selectedMarkerId={selectedVetId}
            onPopupClose={() => setSelectedVetId(null)}
            onViewChange={(lat, lng) => setViewCenter([lng, lat])}
            className="h-full w-full"
          />
          <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-white/95 dark:bg-gray-900/90 px-2.5 py-1.5 text-[11px] text-gray-700 dark:text-gray-200 shadow-md ring-1 ring-black/5 dark:ring-white/10 backdrop-blur z-10">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VET_PIN_COLOR }} />
              Clinic
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VET_PIN_EMERGENCY }} />
              Emergency
            </span>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-800/50">
          <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
            <span>
              {filteredVets.length} {filteredVets.length === 1 ? 'vet' : 'vets'}
              {search && vets.length !== filteredVets.length && ` · ${vets.length - filteredVets.length} filtered`}
            </span>
            {selectedVetId && (
              <button
                onClick={() => setSelectedVetId(null)}
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
              <p className="text-red-500 dark:text-red-400 text-sm text-center py-6">
                Failed to load vets. Check your connection.
              </p>
            ) : filteredVets.length === 0 ? (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                <p className="text-3xl mb-2">🩺</p>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {vets.length > 0
                    ? 'No vets match your search or filter.'
                    : "No clinics in your area yet — we're still importing."}
                </p>
                {vets.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 max-w-xs mx-auto">
                    Clinics come from{' '}
                    <a
                      href="https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dveterinary"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-500 hover:underline"
                    >
                      OpenStreetMap
                    </a>
                    . Missing one? Add it there and it'll appear after the next sync.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredVets.map((vet) => {
                  const isSelected = selectedVetId === vet.id;
                  return (
                    <Link
                      key={vet.id}
                      ref={(el) => { listRefs.current[vet.id] = el; }}
                      to={`/vets/${vet.id}`}
                      onClick={(e) => {
                        if (!isSelected) {
                          e.preventDefault();
                          setSelectedVetId(vet.id);
                        }
                      }}
                      className={`block p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-white dark:bg-gray-900 border-brand-300 ring-2 ring-brand-200 shadow-sm'
                          : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-brand-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">
                              {vet.name}
                            </h3>
                            {vet.attributes?.emergency && (
                              <span className="inline-flex items-center px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 text-[10px] font-semibold rounded-full">
                                Emergency
                              </span>
                            )}
                            {vet.attributes?.open_24_7 && (
                              <span className="inline-flex items-center px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 text-[10px] font-semibold rounded-full">
                                24/7
                              </span>
                            )}
                          </div>
                          {vet.address && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{vet.address}</p>
                          )}
                          {vet.hours && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{vet.hours}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {vet.phone && (
                            <a
                              href={`tel:${vet.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                            >
                              Call
                            </a>
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
