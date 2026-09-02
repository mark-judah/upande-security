import { useQuery } from '@tanstack/react-query';
import {
  fetchShiftDashboard,
  type ShiftDashboardInput,
  type ShiftDashboardResult,
} from '@/lib/services/securityDashboard';

/**
 * Command Center — Shift Planning. Backed by the one-off whitelisted-method
 * wrapper in lib/services/securityDashboard.ts, NOT the general Server
 * Script `api` object — see that file's header comment before copying this
 * pattern elsewhere.
 */
export function useShiftDashboard(input: ShiftDashboardInput) {
  return useQuery<ShiftDashboardResult>({
    queryKey: [
      'command-center-shifts',
      input.period,
      input.from_date ?? '',
      input.to_date ?? '',
      input.farm ?? '',
      input.shift_type ?? '',
      input.status ?? '',
      input.company ?? '',
    ],
    queryFn: () => fetchShiftDashboard(input),
    staleTime: 5 * 60 * 1000,
  });
}
