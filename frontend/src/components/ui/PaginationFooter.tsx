import { useEffect } from 'react';
import Button from './Button';

interface PaginationFooterProps {
  offset: number;
  pageSize: number;
  rendered: number;
  total: number;
  onChange: (offset: number) => void;
}

/**
 * Standard Prev / "X–Y of N" / Next footer used across admin list views.
 * Renders nothing when there's only one page of results.
 */
export default function PaginationFooter({
  offset,
  pageSize,
  rendered,
  total,
  onChange,
}: PaginationFooterProps) {
  // Step back when the page we're on no longer exists. Clearing the last row
  // of the last page (reviewing the final report, closing the final ticket)
  // left `offset` pointing past the end: the list rendered its empty state —
  // "Queue is clear" — and this footer hid itself, with earlier pages still
  // full. Only when the total is known and non-zero: while a page is loading
  // the caller's total reads 0, which says nothing about where we are.
  useEffect(() => {
    if (total > 0 && offset >= total) {
      onChange(Math.max(0, (Math.ceil(total / pageSize) - 1) * pageSize));
    }
  }, [total, offset, pageSize, onChange]);

  if (total <= pageSize) return null;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + rendered, total);
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600 dark:text-gray-300">
      <Button
        size="sm"
        variant="ghost"
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - pageSize))}
      >
        ← Prev
      </Button>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {rangeStart}–{rangeEnd} of {total}
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={rangeEnd >= total}
        onClick={() => onChange(offset + pageSize)}
      >
        Next →
      </Button>
    </div>
  );
}
