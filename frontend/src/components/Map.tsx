import { useCallback, useEffect, useMemo, useRef } from 'react';
import MapLibre, {
  GeolocateControl,
  Marker,
  NavigationControl,
  Popup,
  type MapRef,
  type ViewStateChangeEvent,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label?: string;
  onClick?: () => void;
  /** Optional ReactNode to render inside a popup when this marker is selected. */
  popup?: React.ReactNode;
}

interface MapProps {
  /** [lng, lat] — GeoJSON order, matches MapLibre. */
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  /** Auto-fit the viewport to contain all markers on mount + whenever markers change. */
  fitMarkers?: boolean;
  /** Show the GeolocateControl (center on my location). */
  showLocateMe?: boolean;
  /** Report center + zoom when the user finishes panning. */
  onViewChange?: (lat: number, lng: number, zoom: number) => void;
  /** Which marker id should display its popup (controlled). */
  selectedMarkerId?: string | null;
  /** Notified when the popup is closed (X button or Esc). */
  onPopupClose?: () => void;
}

// Free OSM raster tiles. Override via VITE_MAP_TILE_URL for prod (commercial
// traffic needs a paid tile provider — see DEPLOY.md).
const DEFAULT_TILE_URL =
  (import.meta as any).env?.VITE_MAP_TILE_URL ||
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: [DEFAULT_TILE_URL],
      tileSize: 256,
      attribution:
        '\u00a9 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster' as const,
      source: 'osm',
    },
  ],
};

/** Teardrop pin. Taller than wide so it reads as a map marker at a glance. */
function PinIcon({ color, selected }: { color: string; selected: boolean }) {
  return (
    <svg
      width={selected ? 34 : 28}
      height={selected ? 46 : 38}
      viewBox="0 0 24 32"
      className="drop-shadow-md transition-[width,height] duration-150"
      aria-hidden
    >
      <path
        d="M12 32 C 12 32 22 19 22 12 A 10 10 0 1 0 2 12 C 2 19 12 32 12 32 Z"
        fill={color}
        stroke="white"
        strokeWidth={2}
      />
      <circle cx={12} cy={12} r={3.5} fill="white" />
    </svg>
  );
}

export default function Map({
  center,
  zoom = 12,
  markers = [],
  onMapClick,
  className = '',
  fitMarkers = false,
  showLocateMe = false,
  onViewChange,
  selectedMarkerId = null,
  onPopupClose,
}: MapProps) {
  const mapRef = useRef<MapRef | null>(null);

  const initialViewState = useMemo(
    () => ({ longitude: center[0], latitude: center[1], zoom }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Pan when the parent changes the center.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center, zoom, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);

  // Auto-fit to markers on change.
  useEffect(() => {
    if (!fitMarkers || markers.length === 0) return;
    const map = mapRef.current;
    if (!map) return;
    if (markers.length === 1) {
      map.flyTo({ center: [markers[0].lng, markers[0].lat], zoom: 13, duration: 500 });
      return;
    }
    const lngs = markers.map((m) => m.lng);
    const lats = markers.map((m) => m.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 56, duration: 500, maxZoom: 14 },
    );
  }, [markers, fitMarkers]);

  const selectedMarker = useMemo(
    () => (selectedMarkerId ? markers.find((m) => m.id === selectedMarkerId) : null),
    [markers, selectedMarkerId],
  );

  // When a marker is selected, pan it into view. Offset vertically by ~25% so
  // the popup (which renders above the pin) doesn't hit the top toolbar.
  useEffect(() => {
    if (!selectedMarker) return;
    const map = mapRef.current;
    if (!map) return;
    const height = map.getContainer().clientHeight || 0;
    map.easeTo({
      center: [selectedMarker.lng, selectedMarker.lat],
      duration: 450,
      offset: [0, height ? height * 0.18 : 80],
    });
  }, [selectedMarker]);

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!onMapClick) return;
      onMapClick(e.lngLat.lat, e.lngLat.lng);
    },
    [onMapClick],
  );

  const handleMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      if (!onViewChange) return;
      const { latitude, longitude, zoom: z } = e.viewState;
      onViewChange(latitude, longitude, z);
    },
    [onViewChange],
  );

  return (
    <div className={`relative ${className}`}>
      <MapLibre
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={MAP_STYLE as any}
        onClick={onMapClick ? handleClick : undefined}
        onMoveEnd={onViewChange ? handleMoveEnd : undefined}
        attributionControl={{ compact: true }}
        style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
        cursor={onMapClick ? 'crosshair' : 'grab'}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {showLocateMe && (
          <GeolocateControl
            position="top-right"
            trackUserLocation
            positionOptions={{ enableHighAccuracy: true, timeout: 8000 }}
          />
        )}

        {markers.map((m) => (
          <Marker
            key={m.id}
            longitude={m.lng}
            latitude={m.lat}
            anchor="bottom"
            onClick={(e) => {
              // Stop bubbling so the map's own onClick doesn't fire too.
              e.originalEvent.stopPropagation();
              m.onClick?.();
            }}
          >
            <button
              type="button"
              className="block translate-y-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded-full"
              title={m.label}
              aria-label={m.label}
            >
              <PinIcon color={m.color} selected={selectedMarkerId === m.id} />
            </button>
          </Marker>
        ))}

        {selectedMarker && (
          <Popup
            longitude={selectedMarker.lng}
            latitude={selectedMarker.lat}
            anchor="bottom"
            offset={38}
            closeOnClick={false}
            onClose={() => onPopupClose?.()}
            maxWidth="320px"
            className="fetch-popup"
          >
            <div className="p-3 min-w-[240px]">
              {selectedMarker.popup ?? (
                <div className="text-sm font-medium text-gray-800">
                  {selectedMarker.label ?? ''}
                </div>
              )}
            </div>
          </Popup>
        )}
      </MapLibre>
    </div>
  );
}
