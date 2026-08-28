import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { attachNearbyAlertListeners } from '@/lib/services/nearbyAlert';
import {
  registerForNearbyGuardAlerts,
  watchPushTokenRotation,
  type PushRegistrationStatus,
} from '@/lib/services/pushToken';

const STATUS_MESSAGE: Partial<Record<PushRegistrationStatus, string>> = {
  'no-native-module': 'SOS alerts unavailable — this app needs a fresh install to enable them.',
  'permission-denied': 'SOS alerts are off — enable notifications for this app in phone settings.',
  'no-project-id': 'SOS alerts could not start (app config issue) — contact support.',
  'no-token': 'SOS alerts could not start — try reopening the app.',
  error: 'SOS alerts could not start — try reopening the app.',
};

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
  const feedback = useFeedback();

  // Listeners can be attached regardless of session state — a cold-start
  // notification tap can launch the app before hydration finishes.
  useEffect(() => {
    const detach = attachNearbyAlertListeners();
    return detach;
  }, []);

  useEffect(() => {
    if (!hasSession) return;
    registerForNearbyGuardAlerts()
      .then((status) => {
        // Only surface the cases that actually mean "SOS alerts are off" —
        // previously every failure was silent, which is exactly what made
        // this impossible to diagnose from the field.
        if (status !== 'ok') feedback.warning(STATUS_MESSAGE[status] ?? 'SOS alerts could not start.');
      })
      .catch(() => {});
    const stopWatching = watchPushTokenRotation();
    return stopWatching;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession]);
}
