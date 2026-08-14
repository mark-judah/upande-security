import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { startLocationPing, stopLocationPing } from '@/lib/services/locationPing';

/**
 * Mount once inside the root layout, alongside useNearbyGuardAlerts(). Keeps
 * any logged-in user's last-known location fresh enough to be found
 * "nearby" for SOS alerting, via a lightweight periodic one-shot fix --
 * distinct from (and skipped entirely during) full patrol GPS tracking.
 *
 * Starts once authenticated, stops on logout -- see locationPing.ts for the
 * actual interval + patrol-active guard.
 */
export function useLocationPing(): void {
  const hasSession = useAuthStore((s) => s.hasSession);

  useEffect(() => {
    if (!hasSession) return;
    startLocationPing();
    return () => stopLocationPing();
  }, [hasSession]);
}
