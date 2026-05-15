// Client-side swipe quota tracker.
// Free users: 50 swipes/day. Each rewarded ad grants +25, capped at 150/day.
// Subscribers bypass entirely (the consuming component checks isSubscriber).

const FREE_DAILY = 50;
const REWARD_INCREMENT = 25;
const MAX_DAILY = 150;

function todayKey(userId: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `fetch.swipe_quota.${userId}.${ymd}`;
}

interface QuotaState {
  used: number;
  cap: number;
}

function read(userId: string): QuotaState {
  try {
    const raw = localStorage.getItem(todayKey(userId));
    if (!raw) return { used: 0, cap: FREE_DAILY };
    const parsed = JSON.parse(raw);
    return {
      used: Number(parsed.used) || 0,
      cap: Math.min(MAX_DAILY, Number(parsed.cap) || FREE_DAILY),
    };
  } catch {
    return { used: 0, cap: FREE_DAILY };
  }
}

function write(userId: string, state: QuotaState) {
  try {
    localStorage.setItem(todayKey(userId), JSON.stringify(state));
  } catch {
    // localStorage unavailable; fail silent
  }
}

export const swipeQuota = {
  FREE_DAILY,
  REWARD_INCREMENT,
  MAX_DAILY,
  get(userId: string): QuotaState {
    return read(userId);
  },
  remaining(userId: string): number {
    const { used, cap } = read(userId);
    return Math.max(0, cap - used);
  },
  consume(userId: string): QuotaState {
    const cur = read(userId);
    const next = { ...cur, used: cur.used + 1 };
    write(userId, next);
    return next;
  },
  grantReward(userId: string): QuotaState {
    const cur = read(userId);
    const newCap = Math.min(MAX_DAILY, cur.cap + REWARD_INCREMENT);
    const next = { ...cur, cap: newCap };
    write(userId, next);
    return next;
  },
  canEarnMore(userId: string): boolean {
    const { cap } = read(userId);
    return cap < MAX_DAILY;
  },
};
