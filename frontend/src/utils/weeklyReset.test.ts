import { describe, it, expect } from 'vitest';
import { formatWeekOf, nextWeeklyReset, weekBucket } from './weeklyReset';

describe('weekBucket', () => {
  it('files a Monday morning (UTC) under that same Monday', () => {
    expect(weekBucket(0, new Date('2026-11-09T00:30:00Z'))).toBe('2026-11-09');
  });

  it('files late Sunday (UTC) under the Monday before', () => {
    expect(weekBucket(0, new Date('2026-11-15T23:59:00Z'))).toBe('2026-11-09');
  });

  it('steps back whole weeks, across a month boundary', () => {
    expect(weekBucket(1, new Date('2026-11-14T12:00:00Z'))).toBe('2026-11-02');
    expect(weekBucket(2, new Date('2026-11-14T12:00:00Z'))).toBe('2026-10-26');
  });

  it("agrees with the reset: the bucket's Monday plus a week is the next reset", () => {
    const now = new Date('2026-11-12T08:00:00Z');
    const next = new Date(`${weekBucket(0, now)}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 7);
    expect(next.toISOString()).toBe(nextWeeklyReset(now).toISOString());
  });
});

describe('formatWeekOf', () => {
  it('reads a bucket as a short date, without drifting a day in western time zones', () => {
    expect(formatWeekOf('2026-11-02')).toMatch(/Nov\w*\.? 2\b|2\.? Nov/);
  });

  it('passes through anything that is not a date', () => {
    expect(formatWeekOf('soon')).toBe('soon');
  });
});
