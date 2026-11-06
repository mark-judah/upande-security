import { useQuery } from '@tanstack/react-query';
import { api, type GuardRankingHalf, type GuardRankingPeriod, type GuardRankingResult } from '@/lib/services/api';

/** Guard performance for Command Center - the same ranking as the Security
 *  Dashboard (patrol coverage, distance, checkpoint scans, safety), for the
 *  whole security day or just its day or night half. */
export function useGuardRanking(period: GuardRankingPeriod, half: GuardRankingHalf = 'all') {
  return useQuery<GuardRankingResult>({
    queryKey: ['guard-ranking', period, half],
    queryFn: () => api.guardRanking({ period, half }),
    staleTime: 5 * 60 * 1000,
  });
}
