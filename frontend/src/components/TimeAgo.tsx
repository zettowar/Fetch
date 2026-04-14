import { useEffect, useState } from 'react';
import { relativeTime } from '../utils/time';

interface TimeAgoProps {
  value: string;
  className?: string;
  /** Minutes between re-renders; defaults to 1. */
  intervalMinutes?: number;
}

/**
 * Renders a relative timestamp that refreshes itself on an interval so strings
 * like "2m ago" don't stay frozen on long-lived pages.
 */
export default function TimeAgo({ value, className, intervalMinutes = 1 }: TimeAgoProps) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), intervalMinutes * 60_000);
    return () => clearInterval(id);
  }, [intervalMinutes]);
  const parsed = new Date(value);
  const title = isNaN(parsed.getTime()) ? undefined : parsed.toLocaleString();
  return (
    <span className={className} title={title}>
      {relativeTime(value)}
    </span>
  );
}
