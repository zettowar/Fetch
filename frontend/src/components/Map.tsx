import { useEffect, useRef } from 'react';

interface MapProps {
  center: [number, number]; // [lng, lat]
  zoom?: number;
  markers?: Array<{
    id: string;
    lat: number;
    lng: number;
    color: string;
    label?: string;
    onClick?: () => void;
  }>;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

/**
 * Lightweight map component using an iframe to OpenStreetMap.
 * In production, replace with MapLibre GL JS for proper interactivity.
 * This provides a working map without adding a heavy dependency for now.
 */
export default function Map({ center, zoom = 13, markers = [], onMapClick, className = '' }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`relative ${className}`}>
      {/* Static map background */}
      <div
        ref={containerRef}
        className="w-full h-full bg-gray-100 rounded-xl overflow-hidden relative"
        onClick={(e) => {
          if (onMapClick) {
            // Approximate click-to-coordinate conversion (placeholder)
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            // This is a rough approximation
            const lat = center[1] + (0.5 - y) * 0.02 * (14 / zoom);
            const lng = center[0] + (x - 0.5) * 0.04 * (14 / zoom);
            onMapClick(lat, lng);
          }
        }}
      >
        <iframe
          title="Map"
          className="w-full h-full border-0 pointer-events-none"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${center[0] - 0.05},${center[1] - 0.03},${center[0] + 0.05},${center[1] + 0.03}&layer=mapnik`}
        />

        {/* Marker overlays */}
        {markers.map((marker) => {
          // Approximate marker positioning relative to map center
          const dx = (marker.lng - center[0]) / 0.1;
          const dy = (center[1] - marker.lat) / 0.06;
          const left = 50 + dx * 100;
          const top = 50 + dy * 100;

          if (left < 0 || left > 100 || top < 0 || top > 100) return null;

          return (
            <button
              key={marker.id}
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-125 transition-transform z-10"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                backgroundColor: marker.color,
              }}
              onClick={(e) => {
                e.stopPropagation();
                marker.onClick?.();
              }}
              title={marker.label}
            />
          );
        })}
      </div>
    </div>
  );
}
