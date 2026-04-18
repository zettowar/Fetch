import { useEffect, useState } from 'react';
import Map from './Map';

interface Props {
  /** Current picked coordinates, or null if none. */
  value: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number } | null) => void;
  /** Map fallback center when no value is picked. Defaults to SF. */
  fallbackCenter?: [number, number]; // [lng, lat]
  heightClass?: string;
}

const DEFAULT_FALLBACK: [number, number] = [-122.4194, 37.7749];

export default function LocationPicker({
  value,
  onChange,
  fallbackCenter = DEFAULT_FALLBACK,
  heightClass = 'h-64',
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
    ? [
        {
          id: 'picked',
          lat: value.lat,
          lng: value.lng,
          color: '#f59e0b',
          label: 'Selected location',
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-2">
      <div className={`w-full ${heightClass} overflow-hidden rounded-xl border border-gray-200`}>
        <Map
          center={center}
          zoom={value ? 14 : 12}
          markers={markers}
          onMapClick={(lat, lng) => onChange({ lat, lng })}
          showLocateMe
          className="h-full w-full"
        />
      </div>
      <p className="text-xs text-gray-500">
        {value ? (
          <>
            <span className="font-medium text-gray-700">Selected: </span>
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
    </div>
  );
}
