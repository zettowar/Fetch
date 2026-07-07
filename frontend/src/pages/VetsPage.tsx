import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { getNearbyVets } from '../api/vets';
import Map from '../components/Map';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import SearchInput from '../components/ui/SearchInput';
import { ListSkeleton } from '../components/ui/Skeleton';
import PawSpinner from '../components/flair/PawSpinner';
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
          {v.attributes?.emergency && <Badge variant="danger">Emergency</Badge>}
          {v.attributes?.open_24_7 && <Badge variant="warning">24/7</Badge>}
          {v.attributes?.house_calls && <Badge variant="info">House calls</Badge>}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/app/vets/${v.id}`)}
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
          <Stethoscope size={20} aria-hidden className="text-brand-500" /> Vets
        </h1>

        <SearchInput
          className="mt-2.5"
          value={search}
          onChange={setSearch}
          placeholder="Search vets by name or address..."
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
          {isLoading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 glass rounded-full px-4 py-2 shadow-soft-lg">
              <PawSpinner size="sm" />
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-white/95 dark:bg-gray-900/90 px-2.5 py-1.5 text-2xs text-gray-700 dark:text-gray-200 shadow-soft ring-1 ring-black/5 dark:ring-white/10 backdrop-blur z-10">
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
              <ListSkeleton rows={4} />
            ) : isError ? (
              <p className="text-danger-500 dark:text-danger-400 text-sm text-center py-6">
                Failed to load vets. Check your connection.
              </p>
            ) : filteredVets.length === 0 ? (
              <EmptyState
                illustration="sniffing"
                title={
                  vets.length > 0
                    ? 'No vets match your search or filter.'
                    : "No clinics in your area yet — we're still importing."
                }
                body={
                  vets.length === 0 ? (
                    <>
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
                    </>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-2">
                {filteredVets.map((vet) => {
                  const isSelected = selectedVetId === vet.id;
                  return (
                    <Link
                      key={vet.id}
                      ref={(el) => { listRefs.current[vet.id] = el; }}
                      to={`/app/vets/${vet.id}`}
                      onClick={(e) => {
                        if (!isSelected) {
                          e.preventDefault();
                          setSelectedVetId(vet.id);
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
                              {vet.name}
                            </h3>
                            {vet.attributes?.emergency && <Badge variant="danger">Emergency</Badge>}
                            {vet.attributes?.open_24_7 && <Badge variant="warning">24/7</Badge>}
                          </div>
                          {vet.address && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{vet.address}</p>
                          )}
                          {vet.hours && (
                            <p className="text-2xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{vet.hours}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {vet.phone && (
                            // Not an <a>: anchors can't nest inside the row Link
                            // (invalid DOM — browsers split it and taps misfire).
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.location.href = `tel:${vet.phone}`;
                              }}
                              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                            >
                              Call
                            </button>
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
