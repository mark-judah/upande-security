import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { startScheduledUpdateCheck, stopScheduledUpdateCheck } from '@/lib/services/scheduledUpdate';

/**
 * Mount once inside the root layout, alongside useNearbyGuardAlerts() and
 * useLocationPing(). Automatically checks for and applies an OTA update once
 * a day inside the 21:00 window — see scheduledUpdate.ts for why that time
 * and not on-launch/on-foreground.
 *
 * Starts once authenticated, stops on logout.
 */
export function useScheduledAppUpdate(): void {
  const hasSession = useAuthStore((s) => s.hasSession);

  useEffect(() => {
    if (!hasSession) return;
    startScheduledUpdateCheck();
    return () => stopScheduledUpdateCheck();
  }, [hasSession]);
}
