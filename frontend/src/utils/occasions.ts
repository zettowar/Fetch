/**
 * A pet's day: a birthday, or a homecoming (the anniversary of the day a
 * rescue handed them to their family — `adopted_at`). The brand book has no
 * page for these; they are the brand's warmth applied to the calendar.
 *
 * Both are matched on the viewer's local calendar day. A Feb 29 date is
 * celebrated on Feb 28 in other years rather than skipped.
 */
export type Occasion = { kind: 'birthday' | 'homecoming'; years: number };

type Day = { y: number; m: number; d: number };

/** A date-only string ("2021-11-14") as calendar parts — no UTC drift. */
function dateOnly(s: string): Day | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

/** A timestamp as the local calendar day it fell on. */
function localDay(s: string): Day | null {
  const t = new Date(s);
  return isNaN(t.getTime()) ? null : { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
}

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Whole years since `then` if today is its anniversary, else null. */
function anniversary(then: Day | null, now: Date): number | null {
  if (!then) return null;
  const today = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  const { m } = then;
  const d = m === 2 && then.d === 29 && !isLeap(today.y) ? 28 : then.d;
  if (m !== today.m || d !== today.d) return null;
  const years = today.y - then.y;
  return years >= 1 ? years : null;
}

export function occasionToday(
  pet: { birthday?: string | null; adopted_at?: string | null },
  now: Date = new Date(),
): Occasion | null {
  const bday = pet.birthday ? anniversary(dateOnly(pet.birthday), now) : null;
  if (bday) return { kind: 'birthday', years: bday };
  const home = pet.adopted_at ? anniversary(localDay(pet.adopted_at), now) : null;
  if (home) return { kind: 'homecoming', years: home };
  return null;
}

/** "turns 3" / "1 year home" — the short form for stickers and strips. */
export function occasionShort(o: Occasion): string {
  return o.kind === 'birthday'
    ? 'Birthday!'
    : `${o.years} ${o.years === 1 ? 'year' : 'years'} home`;
}
