import { useEffect, useState } from 'react';

/**
 * Next Monday 00:00 UTC (the backend Celery beat job runs at 00:05).
 */
export function nextWeeklyReset(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(0, 0, 0, 0);
  const daysUntilMon = (8 - next.getUTCDay()) % 7 || 7;
  next.setUTCDate(next.getUTCDate() + daysUntilMon);
  return next;
}

const clock = (d: Date): string =>
  d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * When the week turns over, in the reader's own time: "Sunday at 7:00 p.m." in
 * Toronto, "Monday at 1:00 a.m." in Berlin.
 *
 * The reset is Monday 00:00 UTC, and the copy used to say "Monday" everywhere.
 * For the launch market that is wrong by most of a day: an owner in the lead
 * was told to "hold on until Monday" while the crown was settled on Sunday
 * evening.
 */
export function weeklyResetAt(now: Date = new Date()): string {
  const at = nextWeeklyReset(now);
  return `${at.toLocaleDateString(undefined, { weekday: 'long' })} at ${clock(at)}`;
}

/** Just the weekday the week turns over on, locally ("Sunday"). */
export function weeklyResetDay(now: Date = new Date()): string {
  return nextWeeklyReset(now).toLocaleDateString(undefined, { weekday: 'long' });
}

/** When the daily swipe allowance refills (00:00 UTC), as a local clock time. */
export function dailyResetAt(now: Date = new Date()): string {
  const at = new Date(now);
  at.setUTCHours(24, 0, 0, 0);
  return clock(at);
}

/**
 * Rankings reset every Monday 00:00 UTC. Returns a short countdown string
 * ("2d 4h 17m", "42m"). Minutes are always included so the value visibly
 * ticks on minute-granularity refreshes.
 */
export function timeUntilWeeklyReset(now: Date = new Date()): string {
  const diffMs = nextWeeklyReset(now).getTime() - now.getTime();
  if (diffMs <= 0) return 'resetting…';
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Self-ticking hook; re-renders every minute with the fresh string. */
export function useWeeklyResetCountdown(): string {
  const [value, setValue] = useState(() => timeUntilWeeklyReset());
  useEffect(() => {
    const id = setInterval(() => setValue(timeUntilWeeklyReset()), 60_000);
    return () => clearInterval(id);
  }, []);
  return value;
}

/**
 * The week bucket the backend files votes and crowns under: that ISO week's
 * Monday (UTC) as YYYY-MM-DD. `weeksAgo = 1` is the week whose crown was
 * settled at the last reset.
 */
export function weekBucket(weeksAgo = 0, now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - sinceMonday - 7 * weeksAgo);
  return d.toISOString().slice(0, 10);
}

/** "Nov 9" for a week bucket ("2026-11-09"); the raw value if it doesn't parse. */
export function formatWeekOf(bucket: string): string {
  const [y, m, d] = bucket.split('-').map(Number);
  if (!y || !m || !d) return bucket;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
