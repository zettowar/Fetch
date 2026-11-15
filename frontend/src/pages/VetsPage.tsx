import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getNearbyVets } from '../api/vets';
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

// Vets are neutral: Leash Navy pins. Emergency clinics take the default
// Ball Orange pin so they stand out without borrowing danger red (an error
// colour) or park green.
const VET_PIN_COLOR = MAP_PIN.ink;
const VET_PIN_EMERGENCY = MAP_PIN.play;

// Inline text link: navy ink on an orange underline.
const LINK =
  'font-bold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit';

type Filter = 'all' | 'emergency' | 'open_24_7';

export default function VetsPage() {
  useDocumentTitle('Vets · Fetchpawz');
  const initialCenter = useUserLocation(DEFAULT_MAP_CENTER);
  const [viewCenter, setViewCenter] = useState<[number, number]>(initialCenter);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedVetId, setSelectedVetId] = useState<string | null>(null);
  const listRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const navigate = useNavigate();

  useEffect(() => {
    setViewCenter(initialCenter);
  }, [initialCenter]);

  const { data: vets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['vets-nearby', viewCenter[1], viewCenter[0]],
    queryFn: () => getNearbyVets(viewCenter[1], viewCenter[0], 30),
    // Keep the last result on screen while the next centre loads. The key is
    // the exact map centre, so without this every pan was a brand-new query
    // with no data: the pins vanished (and any open popup closed) until the
    // response for the new position arrived.
    placeholderData: keepPreviousData,
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
        <p className="text-base font-extrabold text-navy dark:text-biscuit leading-tight">{v.name}</p>
        {v.address && <p className="text-xs text-gray-600 dark:text-gray-300">{v.address}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {v.attributes?.emergency && <Badge variant="brand">Emergency</Badge>}
          {v.attributes?.open_24_7 && <Badge variant="info">24/7</Badge>}
          {v.attributes?.house_calls && <Badge variant="info">House calls</Badge>}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/app/vets/${v.id}`)}
          className="btn btn-secondary btn-sm mt-2 w-full"
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
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 pt-3 pb-2.5 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-night-surface">
        <h1 className="text-2xl leading-none text-navy dark:text-biscuit flex items-center gap-2">
          <BrandIcon name="vet" size={24} /> Vets
        </h1>

        <SearchInput
          className="mt-2.5"
          value={search}
          onChange={setSearch}
          placeholder="Search vets by name or address..."
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
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 glass rounded-full border border-gray-200 px-4 py-2 dark:border-white/10">
              <PawSpinner size="sm" />
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg border border-gray-200 bg-white/95 px-2.5 py-1.5 text-2xs font-bold text-navy backdrop-blur dark:border-white/10 dark:bg-night-surface/95 dark:text-biscuit z-10">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-navy dark:border-biscuit/60" style={{ backgroundColor: VET_PIN_COLOR }} />
              Clinic
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-navy dark:border-biscuit/60" style={{ backgroundColor: VET_PIN_EMERGENCY }} />
              Emergency
            </span>
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1 bg-biscuit dark:bg-night">
          <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-night-surface border-b border-gray-200 dark:border-white/10 sticky top-0 z-10">
            <span>
              {filteredVets.length} {filteredVets.length === 1 ? 'vet' : 'vets'}
              {search && vets.length !== filteredVets.length && ` · ${vets.length - filteredVets.length} filtered`}
            </span>
            {selectedVetId && (
              <button
                onClick={() => setSelectedVetId(null)}
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
              <ErrorState message="Couldn't load vets." onRetry={() => refetch()} />
            ) : filteredVets.length === 0 ? (
              <EmptyState
                illustration="sniffing"
                title={
                  vets.length > 0
                    ? 'No vets match your search or filter.'
                    : 'No clinics in your area yet.'
                }
                body={
                  vets.length === 0 ? (
                    <>
                      We are still expanding coverage here. Know a clinic we should
                      list?{' '}
                      <Link to="/app/support" className={LINK}>
                        Tell us
                      </Link>
                      .
                    </>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-2.5">
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
                              {vet.name}
                            </h3>
                            {vet.attributes?.emergency && <Badge variant="brand">Emergency</Badge>}
                            {vet.attributes?.open_24_7 && <Badge variant="info">24/7</Badge>}
                          </div>
                          {vet.address && (
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 truncate">{vet.address}</p>
                          )}
                          {vet.hours && (
                            <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{vet.hours}</p>
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
                              className="btn btn-secondary btn-sm"
                            >
                              Call
                            </button>
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
