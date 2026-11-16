import { useEffect, useId, useRef, useState } from 'react';
import Map, { MAP_PIN } from './Map';
import { DEFAULT_MAP_CENTER } from '../utils/useUserLocation';

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
  /** Color used for the marker + circle. Default Ball Orange (the search area). */
  accentColor?: string;
}

const DEFAULT_FALLBACK = DEFAULT_MAP_CENTER;

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
  accentColor = MAP_PIN.play,
}: Props) {
  const radiusLabelId = useId();

  // Where the map is looking, which is not the same thing as where the pin is.
  //
  // The picker used to treat them as one: on mount it asked the device where it
  // was and called `onChange` with the answer. That placed a pin nobody had
  // placed. A rescue opening "Edit your details" to fix a typo got a pin at
  // wherever they were sitting, and Save published it on the public rescue
  // map. The fix also arrived up to six seconds late and overwrote a pin the
  // person had already tapped in.
  //
  // So the device's position only ever moves the *view*. A pin is a statement,
  // and it is made by tapping the map or pressing "Use my current location".
  const [view, setView] = useState<[number, number]>(
    value ? [value.lng, value.lat] : fallbackCenter,
  );
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (valueRef.current || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Only a starting view: skip it if a pin went down in the meantime.
        if (cancelled || valueRef.current) return;
        setView([pos.coords.longitude, pos.coords.latitude]);
      },
      () => { /* denied or unavailable — the map stays on the fallback */ },
      // Centring needs a neighbourhood, not a doorstep, so a cached coarse fix
      // is fine and comes back at once.
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 5 * 60 * 1000 },
    );
    return () => { cancelled = true; };
  }, []);

  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);
  const pinMyLocation = () => {
    if (!navigator.geolocation) {
      setLocateFailed(true);
      return;
    }
    setLocating(true);
    setLocateFailed(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChange(here);
        setView([here.lng, here.lat]);
      },
      () => {
        setLocating(false);
        setLocateFailed(true);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  // The view follows the device or the "use my location" button, never a tap:
  // a tap is already on screen, and recentring on it also reset the zoom, which
  // undid the zooming-in someone had just done to place the pin precisely.
  const center = view;
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
      <div className={`w-full ${heightClass} overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10`}>
        <Map
          center={center}
          zoom={zoom}
          markers={markers}
          circles={circles}
          onMapClick={(lat, lng) => onChange({ lat, lng })}
          showLocateMe
          cooperative
          className="h-full w-full"
        />
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-300">
        {value ? (
          <>
            <span className="font-extrabold text-navy dark:text-biscuit">Pinned: </span>
            <span className="font-mono">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="ml-3 font-bold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit"
            >
              Clear
            </button>
          </>
        ) : (
          'Tap the map to drop a pin.'
        )}
      </p>
      <div className="-mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <button
          type="button"
          onClick={pinMyLocation}
          disabled={locating}
          className="font-bold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy disabled:opacity-60 dark:text-biscuit dark:hover:decoration-biscuit"
        >
          {locating ? 'Finding you…' : 'Use my current location'}
        </button>
        {locateFailed && (
          <span role="status" className="text-gray-600 dark:text-gray-300">
            Couldn&rsquo;t get your location. Tap the map instead.
          </span>
        )}
      </div>

      {onRadiusChange && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span id={radiusLabelId} className="field-label">Search radius</span>
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
              {radiusMeters != null ? formatRadius(radiusMeters) : '—'}
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap" role="group" aria-labelledby={radiusLabelId}>
            {RADIUS_PRESETS.map((p) => (
              <button
                key={p.meters}
                type="button"
                onClick={() => onRadiusChange(p.meters)}
                aria-pressed={radiusMeters === p.meters}
                className={`chip ${radiusMeters === p.meters ? 'chip-on' : 'hover:bg-gray-50 dark:hover:bg-night-surface'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-2xs text-gray-500 dark:text-gray-400">
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
