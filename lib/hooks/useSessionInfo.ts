import { useQuery } from '@tanstack/react-query';
import { api, type SecurityFeatureFlags } from '@/lib/services/api';
import { useAuthStore } from '@/lib/stores/authStore';

/** Current user, roles, and linked Employee/Security Guard record — mainly
 * used here for the logged-in guard's own farm (employee.custom_farm), the
 * relevant farm for an entry-gate picker at check-in. */
export function useSessionInfo() {
  // The root layout mounts this (SosWatcher, AppDrawerItems) before anyone is
  // signed in. Without `enabled`, it fired on the login screen, the request
  // interceptor found no cookie and bounced to /login, which re-mounted the
  // screen over and over - the login page flickered. No session, no request.
  const hasSession = useAuthStore((s) => s.hasSession);
  return useQuery({
    queryKey: ['session-info'],
    queryFn: () => api.getSessionInfo(),
    staleTime: 10 * 60 * 1000,
    enabled: hasSession,
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

/** Per-instance feature flag read — the single source of truth every screen
 *  should use instead of reading `sessionInfo.data?.features` directly.
 *  Fails open: a flag that's missing (older cached session, or a key added
 *  server-side after this client shipped) reads as enabled, matching the
 *  backend's own "default true" philosophy. Only an explicit `false` hides
 *  the corresponding entry point. */
export function useFeatureFlag(flag: keyof SecurityFeatureFlags): boolean {
  const { data } = useSessionInfo();
  return data?.features?.[flag] !== false;
}
