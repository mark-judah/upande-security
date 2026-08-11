import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { attachNearbyAlertListeners } from '@/lib/services/nearbyAlert';
import { registerForNearbyGuardAlerts, watchPushTokenRotation } from '@/lib/services/pushToken';

/**
 * Mount once inside the root layout. Wires up the nearby-guard SOS push
 * flow end to end:
 *  - registers this device's Expo push token once logged in (and re-fires
 *    whenever `hasSession` flips true, e.g. after a fresh login),
 *  - re-registers automatically on push token rotation,
 *  - attaches the notification-received / notification-tapped listeners
 *    that route into the full-screen SOS Alert screen.
 *
 * All of this is best-effort — see lib/services/pushToken.ts and
 * lib/services/nearbyAlert.ts for the lazy-require-with-try/catch guards
 * that keep this a no-op on a runtime without expo-notifications built in.
 */
export function useNearbyGuardAlerts(): void {
  const hasSession = useAuthStore((s) => s.hasSession);

  // Listeners can be attached regardless of session state — a cold-start
  // notification tap can launch the app before hydration finishes.
  useEffect(() => {
    const detach = attachNearbyAlertListeners();
    return detach;
  }, []);

  useEffect(() => {
    if (!hasSession) return;
    registerForNearbyGuardAlerts().catch(() => {});
    const stopWatching = watchPushTokenRotation();
    return stopWatching;
  }, [hasSession]);
}
