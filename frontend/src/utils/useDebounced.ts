import { useEffect, useState } from 'react';

/**
 * The value, but only after it has stopped changing for `delayMs`.
 *
 * Intended for search boxes whose value feeds a query key: without it every
 * keystroke is a request, and a nine-character term costs nine full-text scans
 * for eight results nobody sees.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return settled;
}
