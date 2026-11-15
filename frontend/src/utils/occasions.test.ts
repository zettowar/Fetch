import { describe, it, expect } from 'vitest';
import { occasionToday, occasionShort } from './occasions';

// Local noon, so no time zone can push "today" across midnight.
const on = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe('occasionToday', () => {
  it('finds a birthday and how old they turn', () => {
    expect(occasionToday({ birthday: '2023-11-14' }, on(2026, 11, 14))).toEqual({ kind: 'birthday', years: 3 });
  });

  it('is quiet on any other day', () => {
    expect(occasionToday({ birthday: '2023-11-14' }, on(2026, 11, 15))).toBeNull();
  });

  it('does not celebrate a pet born today (nothing to turn yet)', () => {
    expect(occasionToday({ birthday: '2026-11-14' }, on(2026, 11, 14))).toBeNull();
  });

  it('moves a leap-day birthday to Feb 28 in other years', () => {
    expect(occasionToday({ birthday: '2020-02-29' }, on(2026, 2, 28))).toEqual({ kind: 'birthday', years: 6 });
    expect(occasionToday({ birthday: '2020-02-29' }, on(2028, 2, 29))).toEqual({ kind: 'birthday', years: 8 });
    expect(occasionToday({ birthday: '2020-02-29' }, on(2028, 2, 28))).toBeNull();
  });

  it('finds a homecoming from the adoption timestamp', () => {
    const adopted = new Date(2024, 10, 14, 15, 30).toISOString();
    expect(occasionToday({ adopted_at: adopted }, on(2026, 11, 14))).toEqual({ kind: 'homecoming', years: 2 });
  });

  it('lets a birthday win when both land on the same day', () => {
    const adopted = new Date(2024, 10, 14, 9).toISOString();
    expect(occasionToday({ birthday: '2022-11-14', adopted_at: adopted }, on(2026, 11, 14))?.kind).toBe('birthday');
  });

  it('reads the short labels', () => {
    expect(occasionShort({ kind: 'birthday', years: 3 })).toBe('Birthday!');
    expect(occasionShort({ kind: 'homecoming', years: 1 })).toBe('1 year home');
    expect(occasionShort({ kind: 'homecoming', years: 4 })).toBe('4 years home');
  });
});
