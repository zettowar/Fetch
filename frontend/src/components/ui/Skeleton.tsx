interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-soft-sm overflow-hidden animate-fade-in"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="w-full aspect-[4/3] rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function Spinner({
  className = '',
  size = 'md',
  label = 'Loading',
}: { className?: string; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const sizeClass = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  return (
    <div
      role="status"
      aria-label={label}
      className={`animate-spin rounded-full border-2 border-brand-200 border-t-brand-500 ${sizeClass} ${className}`}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-soft-sm divide-y divide-gray-100 dark:divide-gray-800 animate-fade-in"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 animate-fade-in"
          style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
        >
          <Skeleton className="w-9 h-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
