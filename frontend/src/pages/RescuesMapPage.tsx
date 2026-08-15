import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import { getNearbyRescues, type RescuePublic } from '../api/rescues';
import Map from '../components/Map';
import ErrorState from '../components/ui/ErrorState';
import PawSpinner from '../components/flair/PawSpinner';
import { useUserLocation } from '../utils/useUserLocation';

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749]; // San Francisco fallback
const RESCUE_PIN_COLOR = '#8b5cf6'; // violet to match the Rescues theme

export default function RescuesMapPage() {
  const initialCenter = useUserLocation(DEFAULT_CENTER);
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Compact header */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <MapIcon size={20} aria-hidden className="text-brand-500" /> Rescue map
          </h1>
          <Link
            to="/app/rescues/browse"
            className="text-xs font-medium text-brand-500 hover:text-brand-600 whitespace-nowrap"
          >
            Browse list →
          </Link>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Verified rescues plotted near you.
        </p>
      </div>

      {/* Map + list */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-[62%] min-h-[280px] relative">
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
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-gray-900/90 backdrop-blur rounded-xl shadow-soft ring-1 ring-black/5 dark:ring-white/10 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 max-w-[90%] text-center z-10">
              No mapped rescues in this area yet.
            </div>
          )}

          {isLoading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass rounded-full px-4 py-2 shadow-soft-lg">
              <PawSpinner size="sm" />
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800">
          {isError ? (
            <ErrorState message="Couldn't load nearby rescues." onRetry={() => refetch()} />
          ) : rescues.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 text-center">
              No rescues to show.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {rescues.slice(0, 10).map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/app/rescues/${r.id}`}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                    onMouseEnter={() => setSelected(r)}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: RESCUE_PIN_COLOR }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {r.org_name}
                      </p>
                      {r.location && (
                        <p className="text-2xs text-gray-500 dark:text-gray-400 truncate">
                          {r.location}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-brand-500">View</span>
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
      <p className="font-semibold text-gray-900 dark:text-gray-100 leading-tight">
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
      <button
        type="button"
        onClick={onView}
        className="mt-3 w-full rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium py-2 transition-colors"
      >
        View details
      </button>
    </div>
  );
}
