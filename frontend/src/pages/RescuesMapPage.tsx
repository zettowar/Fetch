import { useEffect, useState, type CSSProperties } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getNearbyRescues, type RescuePublic } from '../api/rescues';
import Map from '../components/Map';
import BrandIcon from '../components/brand/BrandIcon';
import Button from '../components/ui/Button';
import ErrorState from '../components/ui/ErrorState';
import PawSpinner from '../components/flair/PawSpinner';
import { DEFAULT_MAP_CENTER, useUserLocation } from '../utils/useUserLocation';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const RESCUE_PIN_COLOR = '#FF5C93'; // Forever Pink: the rescue colour
const PINK_BEAN = { '--bean': 'var(--pink)' } as CSSProperties;

export default function RescuesMapPage() {
  useDocumentTitle('Rescue map · Fetchpawz');
  const initialCenter = useUserLocation(DEFAULT_MAP_CENTER);
  const [viewCenter, setViewCenter] = useState<[number, number]>(initialCenter);
  const [selected, setSelected] = useState<RescuePublic | null>(null);
  const navigate = useNavigate();

  // Keep the query center in sync when the user-location hook resolves a
  // better starting position (initial GPS hit), but otherwise leave it under
  // the user's panning control.
  useEffect(() => {
    setViewCenter(initialCenter);
  }, [initialCenter]);

  const { data: rescues = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['rescues-nearby', viewCenter[1], viewCenter[0]],
    queryFn: () => getNearbyRescues(viewCenter[1], viewCenter[0], 200),
    // Keep the last result on screen while the next centre loads. The key is
    // the exact map centre, so without this every pan was a brand-new query
    // with no data: the pins vanished (and any open popup closed) until the
    // response for the new position arrived.
    placeholderData: keepPreviousData,
  });

  // Drop a selection that was filtered out (e.g. coords changed).
  useEffect(() => {
    if (!selected) return;
    if (!rescues.find((r) => r.id === selected.id)) {
      setSelected(null);
    }
  }, [rescues, selected]);

  const markers = rescues
    .filter((r): r is RescuePublic & { lat: number; lng: number } =>
      r.lat != null && r.lng != null,
    )
    .map((r) => ({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      color: RESCUE_PIN_COLOR,
      label: r.org_name,
      onClick: () => setSelected(r),
      popup: (
        <RescuePopup rescue={r} onView={() => navigate(`/app/rescues/${r.id}`)} />
      ),
    }));

  return (
    // Phone: header, map, list stacked. From `md` the list column (header,
    // list) sits beside a full-height map — the wrapper around map + list
    // turns into `contents` so both join the grid (same as Lost & Found).
    <div className="flex flex-col flex-1 min-h-0 md:grid md:grid-cols-[360px_minmax(0,1fr)] lg:grid-cols-[400px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)]">
      {/* Compact header */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-night-surface md:col-start-1 md:row-start-1 md:border-r md:px-5 md:pt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[28px] leading-none text-navy dark:text-biscuit flex items-center gap-2">
            <BrandIcon name="explore" size={24} style={PINK_BEAN} /> Rescue map
          </h1>
          <Link to="/app/rescues/browse" className="btn btn-ghost btn-sm whitespace-nowrap">
            Browse list →
          </Link>
        </div>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          Verified rescues plotted near you.
        </p>
      </div>

      {/* Map + list */}
      <div className="flex-1 flex flex-col min-h-0 md:contents">
        <div className="h-[62%] min-h-[280px] relative md:h-auto md:min-h-0 md:col-start-2 md:row-start-1 md:row-span-2">
          <Map
            center={initialCenter}
            zoom={10}
            markers={markers}
            showLocateMe
            selectedMarkerId={selected?.id ?? null}
            onPopupClose={() => setSelected(null)}
            onViewChange={(lat, lng) => setViewCenter([lng, lat])}
            className="w-full h-full"
          />

          {!isLoading && !isError && markers.length === 0 && (
            <div className="surface absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 text-sm font-semibold text-navy dark:text-biscuit max-w-[90%] text-center z-10">
              No mapped rescues in this area yet.
            </div>
          )}

          {isLoading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass rounded-full border border-gray-200 dark:border-white/10 px-4 py-2">
              <PawSpinner size="sm" />
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-biscuit dark:bg-night border-t border-gray-200 dark:border-white/10 md:col-start-1 md:row-start-2 md:border-t-0 md:border-r">
          {isError ? (
            <ErrorState message="Couldn't load nearby rescues." onRetry={() => refetch()} />
          ) : rescues.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 text-center">
              No rescues to show.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-white/10">
              {/* Ten fit under the phone's map; the side column has room for the rest. */}
              {rescues.slice(0, 50).map((r, i) => (
                <li key={r.id} className={i >= 10 ? 'hidden md:block' : undefined}>
                  <Link
                    to={`/app/rescues/${r.id}`}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-white dark:hover:bg-night-surface transition-colors"
                    onMouseEnter={() => setSelected(r)}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full border-[1.5px] border-navy flex-shrink-0 dark:border-biscuit/60"
                      style={{ backgroundColor: RESCUE_PIN_COLOR }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-navy dark:text-biscuit truncate">
                        {r.org_name}
                      </p>
                      {r.location && (
                        <p className="text-2xs text-gray-500 dark:text-gray-400 truncate">
                          {r.location}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-extrabold text-navy underline decoration-pink-500 decoration-2 underline-offset-2 dark:text-biscuit">View</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function RescuePopup({
  rescue,
  onView,
}: {
  rescue: RescuePublic;
  onView: () => void;
}) {
  return (
    <div className="flex flex-col">
      <p className="text-base font-extrabold text-navy dark:text-biscuit leading-tight">
        {rescue.org_name}
      </p>
      {rescue.location && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {rescue.location}
        </p>
      )}
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
        {rescue.description}
      </p>
      <Button type="button" variant="rescue" size="sm" onClick={onView} className="mt-3 w-full">
        View details
      </Button>
    </div>
  );
}
