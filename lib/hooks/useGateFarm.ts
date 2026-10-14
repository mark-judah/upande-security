import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import { useSessionInfo } from '@/lib/hooks/useSessionInfo';
import { useFarmStore } from '@/lib/stores/farmStore';

/**
 * The farm whose gates this guard is checking at.
 * - `linked`: from the server - an emergency location change, else today's
 *   roster shift, else the login's own farm. Wins.
 * - otherwise the farm the guard chose on the Gate tab (`needsChoice`).
 * `gate` is the rostered (or changed-to) gate, for pre-selecting pickers.
 */
export function useGateFarm() {
  const sessionInfo = useSessionInfo();
  const chosen = useFarmStore((s) => s.farm);
  const location = sessionInfo.data?.location ?? null;
  const linked =
    location?.farm ?? sessionInfo.data?.checking_farm ?? sessionInfo.data?.employee?.custom_farm ?? null;
  return {
    farm: linked ?? chosen,
    gate: location?.farm && location.farm === linked ? location.gate : null,
    location,
    linked,
    needsChoice: !linked && !!sessionInfo.data,
    loading: sessionInfo.isLoading,
  };
}

/** Every farm with its gates, for the farm picker. */
export function useGateFarms(enabled: boolean) {
  return useQuery({
    queryKey: ['gate-farms'],
    queryFn: () => api.listGateFarms(),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}
