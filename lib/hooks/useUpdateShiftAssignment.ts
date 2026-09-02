import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type UpdateShiftAssignmentInput } from '@/lib/services/api';

/**
 * Command Center — Shift Planning edit (status, dates/times, remarks on a
 * Security Guard Shift Assignment). Backed by the general Server Script
 * `api` object, unlike the read side of Shift Planning
 * (useShiftDashboard/securityDashboard.ts, which is a one-off whitelisted
 * -method exception — see that file's header).
 *
 * useShiftDashboard's query key is `['command-center-shifts', period,
 * from_date, to_date, farm, shift_type, status, company]` — varied by
 * whichever filters are active. Invalidating just the `['command-center
 * -shifts']` prefix (React Query's default partial-match behavior) refreshes
 * every filter combination currently mounted, not just the one the edited
 * row happened to be visible under.
 */
export function useUpdateShiftAssignment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateShiftAssignmentInput) => api.updateShiftAssignment(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['command-center-shifts'] });
    },
  });
}
