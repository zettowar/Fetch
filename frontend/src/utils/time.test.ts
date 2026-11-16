import { describe, expect, it } from 'vitest';
import { petAge } from './time';

// Local-time constructor on purpose: `petAge` reads the viewer's calendar.
const on = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe('petAge', () => {
  it('reads a birthday as a calendar date, not a UTC instant', () => {
    // Born on the 1st: parsed as UTC midnight this was "the 30th" in Canada,
    // and every such pet read a month older.
    expect(petAge('2025-12-01', 'dog', on(2026, 11, 16))).toBe('11 mo');
    expect(petAge('2026-11-01', 'dog', on(2026, 11, 16))).toBe('Puppy');
    expect(petAge('2026-11-01', 'cat', on(2026, 11, 16))).toBe('Kitten');
  });

  it('does not count a month until its day comes round', () => {
    expect(petAge('2025-11-30', 'dog', on(2026, 11, 1))).toBe('11 mo');
    expect(petAge('2025-11-30', 'dog', on(2026, 11, 30))).toBe('1 yr');
    expect(petAge('2023-05-20', 'dog', on(2026, 11, 16))).toBe('3 yrs 5 mo');
  });

  it('has nothing to say without a usable date', () => {
    expect(petAge(null)).toBeNull();
    expect(petAge('not a date')).toBeNull();
  });
});
