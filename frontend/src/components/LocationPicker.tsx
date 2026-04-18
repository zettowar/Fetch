import { useEffect, useState } from 'react';
import Map from './Map';

interface Props {
  /** Current picked coordinates, or null if none. */
  value: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number } | null) => void;
  /** Optional search-area radius in meters. When provided, the picker
   * renders a radius selector + a translucent circle on the map. */
  radiusMeters?: number;
  onRadiusChange?: (meters: number) => void;
  /** Map fallback center when no value is picked. Defaults to SF. */
  fallbackCenter?: [number, number]; // [lng, lat]
  heightClass?: string;
  /** Color used for the marker + circle. Default amber. */
  accentColor?: string;
}

const DEFAULT_FALLBACK: [number, number] = [-122.4194, 37.7749];

// Preset radii — common values that match how reporters think about search areas.
const RADIUS_PRESETS: { label: string; meters: number }[] = [
  { label: '100 m', meters: 100 },
  { label: '250 m', meters: 250 },
  { label: '500 m', meters: 500 },
  { label: '1 km', meters: 1000 },
  { label: '2 km', meters: 2000 },
  { label: '5 km', meters: 5000 },
];

export default function LocationPicker({
  value,
  onChange,
  radiusMeters,
  onRadiusChange,
  fallbackCenter = DEFAULT_FALLBACK,
  heightClass = 'h-64',
  accentColor = '#f59e0b',
}: Props) {
  // Prompt the browser for location on mount if we don't already have one.
  const [requestedGeo, setRequestedGeo] = useState(false);
  useEffect(() => {
    if (value || requestedGeo || !navigator.geolocation) return;
    setRequestedGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* user denied — they can still tap */ },
      { enableHighAccuracy: true, timeout: 6000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const center: [number, number] = value ? [value.lng, value.lat] : fallbackCenter;
  const markers = value
    ? [{ id: 'picked', lat: value.lat, lng: value.lng, color: accentColor, label: 'Selected location' }]
    : [];
  const circles =
    value && radiusMeters
      ? [
          {
            id: 'picked-radius',
            lat: value.lat,
            lng: value.lng,
            radiusMeters,
            color: accentColor,
            fillOpacity: 0.18,
          },
        ]
      : [];

  // Auto-zoom based on radius so the circle always fits with breathing room.
  const zoom = value
    ? radiusMeters
      ? Math.max(11, Math.round(15 - Math.log2(radiusMeters / 250)))
      : 14
    : 12;

  return (
    <div className="flex flex-col gap-3">
      <div className={`w-full ${heightClass} overflow-hidden rounded-xl border border-gray-200`}>
        <Map
          center={center}
          zoom={zoom}
          markers={markers}
          circles={circles}
          onMapClick={(lat, lng) => onChange({ lat, lng })}
          showLocateMe
          className="h-full w-full"
        />
      </div>

      <p className="text-xs text-gray-500">
        {value ? (
          <>
            <span className="font-medium text-gray-700">Pinned: </span>
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            <button
              type="button"
              onClick={() => onChange(null)}
              className="ml-3 text-brand-500 hover:underline"
            >
              Clear
            </button>
          </>
        ) : (
          'Tap the map to pin the location, or use the locate button.'
        )}
      </p>

      {onRadiusChange && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-medium text-gray-700">Search radius</label>
            <span className="text-xs text-gray-500">
              {radiusMeters != null ? formatRadius(radiusMeters) : '—'}
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {RADIUS_PRESETS.map((p) => (
              <button
                key={p.meters}
                type="button"
                onClick={() => onRadiusChange(p.meters)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  radiusMeters === p.meters
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">
            The orange circle on the map shows the area you're asking others to search.
            Also controls how much coordinates are fuzzed on the public map for your privacy.
          </p>
        </div>
      )}
    </div>
  );
}

function formatRadius(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} km`;
  return `${m} m`;
}
