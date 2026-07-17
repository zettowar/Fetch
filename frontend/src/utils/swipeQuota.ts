// Server-authoritative swipe quota (see backend app/services/quota.py).
// The daily cap is enforced by the API — casting a vote past the cap returns
// 429. This hook mirrors the server's count for display and applies optimistic
// deltas between refetches so the counter feels instant; clearing browser
// storage no longer grants extra swipes.
import { useCallback, useMemo, useRef, useState } from 'react';
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
  const { data, isLoading, dataUpdatedAt } = useQuery<SwipeQuota>({
    queryKey: QUOTA_KEY,
    queryFn: getSwipeQuota,
    enabled,
    staleTime: 30_000,
  });

  // Optimistic votes since the last server sync. Reset whenever fresh server
  // data lands (its `used` already accounts for those votes).
  const [delta, setDelta] = useState(0);
  const lastSyncRef = useRef(0);
  if (dataUpdatedAt && dataUpdatedAt !== lastSyncRef.current) {
    lastSyncRef.current = dataUpdatedAt;
    if (delta !== 0) setDelta(0);
  }

  const server = data ?? { used: 0, cap: FREE_DAILY, remaining: FREE_DAILY, unlimited: false };
  const used = server.used + delta;
  const cap = server.cap;
  const unlimited = server.unlimited;
  const remaining = unlimited ? Infinity : Math.max(0, cap - used);
  const blocked = !unlimited && remaining <= 0;
  const canEarnMore = !unlimited && cap < MAX_DAILY;

  const consume = useCallback(() => setDelta((d) => d + 1), []);
  const refund = useCallback(() => setDelta((d) => d - 1), []);
  const sync = useCallback(() => {
    setDelta(0);
    qc.invalidateQueries({ queryKey: QUOTA_KEY });
  }, [qc]);

  const rewardMutation = useMutation({
    mutationFn: grantSwipeReward,
    onSuccess: (fresh) => {
      qc.setQueryData(QUOTA_KEY, fresh);
      setDelta(0);
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
