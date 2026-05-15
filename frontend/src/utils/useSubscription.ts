import { useQuery } from '@tanstack/react-query';
import { getPremiumStatus, type PremiumStatus } from '../api/billing';
import { useAuth } from '../store/AuthContext';

export interface SubscriptionState {
  isSubscriber: boolean;
  entitlement: string | null;
  isLoading: boolean;
}

export function useSubscription(): SubscriptionState {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useQuery<PremiumStatus>({
    queryKey: ['billing-status'],
    queryFn: getPremiumStatus,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  return {
    isSubscriber: Boolean(data?.is_premium),
    entitlement: data?.entitlement ?? null,
    isLoading,
  };
}
