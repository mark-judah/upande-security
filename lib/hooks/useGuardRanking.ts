import { useQuery } from '@tanstack/react-query';
import { api, type GuardRankingPeriod, type GuardRankingResult } from '@/lib/services/api';

/** Guard performance for Command Center - the same ranking as the Security
 *  Dashboard (patrol coverage, distance, checkpoint scans, safety). */
export function useGuardRanking(period: GuardRankingPeriod) {
  return useQuery<GuardRankingResult>({
    queryKey: ['guard-ranking', period],
    queryFn: () => api.guardRanking({ period }),
    staleTime: 5 * 60 * 1000,
  });
}
