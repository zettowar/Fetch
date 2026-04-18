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
  if (total <= pageSize) return null;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + rendered, total);
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <Button
        size="sm"
        variant="ghost"
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - pageSize))}
      >
        ← Prev
      </Button>
      <span className="text-xs text-gray-500">
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
