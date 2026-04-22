import { useEffect, useState } from 'react';

const CACHE_KEY = 'user-location';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const IP_LOOKUP_URL = 'https://ipapi.co/json/';

type Source = 'gps' | 'ip';

interface CachedLocation {
  lng: number;
  lat: number;
  ts: number;
  source: Source;
}

function readCache(): CachedLocation | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.lng === 'number' &&
      typeof parsed?.lat === 'number' &&
      typeof parsed?.ts === 'number' &&
      Date.now() - parsed.ts < CACHE_MAX_AGE_MS
    ) {
      return parsed as CachedLocation;
    }
  } catch {
    /* ignore malformed cache */
  }
  return null;
}

function writeCache(coords: [number, number], source: Source): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ lng: coords[0], lat: coords[1], ts: Date.now(), source }),
    );
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Returns a map center as `[lng, lat]`. Renders immediately with a cached or
 * fallback value, then asynchronously upgrades through two layers:
 *
 *   1. Browser Geolocation API — precise, requires permission.
 *   2. IP-based lookup (ipapi.co) — city-accurate, no permission required. Used
 *      only when no fresh cache exists, so subsequent visits skip the network
 *      call. GPS always wins if it resolves.
 *
 * If both fail, the provided fallback remains.
 */
export function useUserLocation(fallback: [number, number]): [number, number] {
  const [center, setCenter] = useState<[number, number]>(() => {
    const cached = readCache();
    return cached ? [cached.lng, cached.lat] : fallback;
  });

  useEffect(() => {
    const cached = readCache();
    let cancelled = false;
    let gotGps = false;

    // Layer 1: precise GPS. Always attempted — permission may have been granted
    // since the last visit, and a fresh GPS fix should override cached IP data.
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          gotGps = true;
          const next: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          setCenter(next);
          writeCache(next, 'gps');
        },
        undefined,
        { timeout: 8000, maximumAge: 5 * 60 * 1000 },
      );
    }

    // Layer 2: IP-based approximate location. Skip if we already have a usable
    // cached location — avoids hitting the third-party service on every mount.
    if (!cached) {
      fetch(IP_LOOKUP_URL, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || gotGps || !data) return;
          const lng = data.longitude;
          const lat = data.latitude;
          if (typeof lng !== 'number' || typeof lat !== 'number') return;
          setCenter([lng, lat]);
          writeCache([lng, lat], 'ip');
        })
        .catch(() => {
          /* network / service error — keep current fallback */
        });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return center;
}
