import { useEffect } from 'react';

/**
 * Sets document.title while mounted, restores the prior title on unmount.
 * Pass null/undefined to leave the title untouched (e.g. while data is loading).
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
