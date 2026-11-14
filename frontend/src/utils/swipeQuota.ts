// Server-authoritative swipe quota (see backend app/services/quota.py).
// The daily cap is enforced by the API — casting a vote past the cap returns
// 429. This hook mirrors the server's count for display and applies optimistic
// changes between refetches so the counter feels instant; clearing browser
// storage no longer grants extra swipes.
//
// The optimistic changes are written into the query cache, not kept in the
// hook. They used to live in component state, which meant every screen had its
// own count and it died with the screen: swipe a few pets, switch tabs, and
// both Home and the deck you came back to read "50 swipes left" again until
// the 30-second cache expired.
import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSwipeQuota, grantSwipeReward, type SwipeQuota } from '../api/votes';

// Kept in sync with backend app/services/quota.py.
export const FREE_DAILY = 50;
export const REWARD_INCREMENT = 25;
export const MAX_DAILY = 150;

const QUOTA_KEY = ['swipe-quota'];

export interface UseSwipeQuota {
  used: number;
  cap: number;
  remaining: number;
  unlimited: boolean;
  isLoading: boolean;
  blocked: boolean;
  canEarnMore: boolean;
  consume: () => void;
  refund: () => void;
  grantReward: () => void;
  /** Re-sync with the server (e.g. after a 429). Clears the optimistic delta. */
  sync: () => void;
}

export function useSwipeQuota(enabled: boolean): UseSwipeQuota {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SwipeQuota>({
    queryKey: QUOTA_KEY,
    queryFn: getSwipeQuota,
    enabled,
    staleTime: 30_000,
  });

  const server = data ?? { used: 0, cap: FREE_DAILY, remaining: FREE_DAILY, unlimited: false };
  const used = server.used;
  const cap = server.cap;
  const unlimited = server.unlimited;
  const remaining = unlimited ? Infinity : Math.max(0, cap - used);
  const blocked = !unlimited && remaining <= 0;
  const canEarnMore = !unlimited && cap < MAX_DAILY;

  // Shift the cached count by one vote. The next server fetch replaces it
  // with the authoritative figure, which already includes these votes.
  const adjust = useCallback(
    (by: number) => {
      qc.setQueryData<SwipeQuota>(QUOTA_KEY, (current) => {
        if (!current || current.unlimited) return current;
        const nextUsed = Math.max(0, current.used + by);
        return { ...current, used: nextUsed, remaining: Math.max(0, current.cap - nextUsed) };
      });
    },
    [qc],
  );
  const consume = useCallback(() => adjust(1), [adjust]);
  const refund = useCallback(() => adjust(-1), [adjust]);
  const sync = useCallback(() => {
    qc.invalidateQueries({ queryKey: QUOTA_KEY });
  }, [qc]);

  const rewardMutation = useMutation({
    mutationFn: grantSwipeReward,
    onSuccess: (fresh) => {
      qc.setQueryData(QUOTA_KEY, fresh);
    },
  });
  const grantReward = useCallback(() => rewardMutation.mutate(), [rewardMutation]);

  return useMemo(
    () => ({
      used,
      cap,
      remaining,
      unlimited,
      isLoading,
      blocked,
      canEarnMore,
      consume,
      refund,
      grantReward,
      sync,
    }),
    [used, cap, remaining, unlimited, isLoading, blocked, canEarnMore, consume, refund, grantReward, sync],
  );
}
