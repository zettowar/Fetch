import { useQuery } from '@tanstack/react-query';
import { getPublicFlags, type PublicFlags } from '../api/publicSite';

// Fail-open: if flags can't be fetched (offline, transient error), show every
// section rather than hiding features. Also the value used before the first
// fetch resolves. Polls on a 60s cadence to match the backend's 30s cache TTL.
const DEFAULT_FLAGS: PublicFlags = {
  explore_enabled: true,
  explore_parks_enabled: true,
  explore_pack_enabled: true,
  explore_donate_enabled: true,
  explore_shop_enabled: true,
  explore_vets_enabled: true,
};

export function usePublicFlags(): PublicFlags {
  const { data } = useQuery({
    queryKey: ['public-flags'],
    queryFn: getPublicFlags,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  return { ...DEFAULT_FLAGS, ...(data ?? {}) };
}
