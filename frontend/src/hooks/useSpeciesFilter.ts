import { useCallback, useEffect, useState } from 'react';
import type { Species } from '../types';

/**
 * The persistent species view preference, shared across the swipe deck, the
 * dashboard crowns, and explore. 'all' means a mixed view (both crowns / a
 * mixed deck); 'dog' or 'cat' scopes everything to one species.
 *
 * Stored in localStorage (v1) so it persists across reloads. A module-level
 * listener set keeps every hook instance in the same tab in sync (the native
 * `storage` event only fires in *other* tabs).
 */
export type SpeciesFilter = 'all' | Species;

const KEY = 'fetch.speciesFilter';
const listeners = new Set<(v: SpeciesFilter) => void>();

function read(): SpeciesFilter {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dog' || v === 'cat' || v === 'all') return v;
  } catch {
    /* ignore */
  }
  return 'all';
}

export function useSpeciesFilter(): [SpeciesFilter, (v: SpeciesFilter) => void] {
  const [value, setValue] = useState<SpeciesFilter>(read);

  useEffect(() => {
    const fn = (v: SpeciesFilter) => setValue(v);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const set = useCallback((v: SpeciesFilter) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
    listeners.forEach((fn) => fn(v));
  }, []);

  return [value, set];
}

/** API `species` param for a filter — undefined means "no filter" (mixed). */
export function filterToSpecies(f: SpeciesFilter): Species | undefined {
  return f === 'all' ? undefined : f;
}
