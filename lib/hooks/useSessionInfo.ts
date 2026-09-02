import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

/** Current user, roles, and linked Employee/Security Guard record — mainly
 * used here for the logged-in guard's own farm (employee.custom_farm), the
 * relevant farm for an entry-gate picker at check-in. */
export function useSessionInfo() {
  return useQuery({
    queryKey: ['session-info'],
    queryFn: () => api.getSessionInfo(),
    staleTime: 10 * 60 * 1000,
  });
}

/** Role-gated Command Center section (Security Head / System Manager, or
 *  anyone explicitly allow-listed in Security Ops Settings). Mirrors the
 *  useIsApprover() pattern in usePendingApprovals.ts, but sourced from
 *  session info rather than a separate query — has_command_center_access
 *  is already resolved server-side as part of that payload (the client has
 *  no way to know about allowlist membership on its own, so this must not
 *  be re-derived from `roles`). */
export function useHasCommandCenterAccess(): boolean {
  const { data } = useSessionInfo();
  return Boolean(data?.has_command_center_access);
}
