import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { getNotifications } from './pushToken';

/**
 * Nearby-guard SOS alert receipt.
 *
 * IMPLEMENTATION NOTE — notifee was evaluated and NOT used. See the
 * mobile-rn task report for the full reasoning; in short: the current
 * @notifee/react-native release ships no Expo config plugin at all (no
 * app.plugin.js), hardcodes an old compileSdk/targetSdk in its own
 * android/build.gradle, and hasn't been updated for the current Expo/RN/
 * new-architecture combination this app builds against. Per the task's own
 * fallback instructions, this uses `expo-notifications` only: a heads-up
 * (not true full-screen-intent) system notification, plus best-effort
 * in-app navigation straight to the full-screen SOS Alert screen whenever
 * the app is foregrounded or gets opened via the notification tap.
 */

export type SosAlertPushData = {
  type: 'sos_alert';
  guard_name?: string;
  latitude?: number | string;
  longitude?: number | string;
  incident_name?: string;
  distance_m?: number | string;
};

function isSosAlertPayload(data: unknown): data is SosAlertPushData {
  return !!data && typeof data === 'object' && (data as { type?: unknown }).type === 'sos_alert';
}

let _handled = false;
let _handledResetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Routes an incoming `sos_alert` push payload to the full-screen alert
 * screen. Safe to call multiple times for the same push (foreground
 * listener + tap response can both fire) — de-duplicated for a short
 * window.
 */
export function handleIncomingPush(data: unknown): void {
  if (!isSosAlertPayload(data)) return;

  // Cheap de-dupe: the same push can reach us via both the foreground
  // "received" listener and the "response" (tap) listener.
  if (_handled) return;
  _handled = true;
  if (_handledResetTimer) clearTimeout(_handledResetTimer);
  _handledResetTimer = setTimeout(() => {
    _handled = false;
  }, 2000);

  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

  try {
    router.push({
      pathname: '/sos-alert',
      params: {
        guard_name: data.guard_name ?? '',
        latitude: String(data.latitude ?? ''),
        longitude: String(data.longitude ?? ''),
        incident_name: data.incident_name ?? '',
        distance_m: String(data.distance_m ?? ''),
      },
    });
  } catch (e) {
    if (__DEV__) console.warn('[nearbyAlert] failed to navigate to /sos-alert:', e);
  }
}

let _listenersAttached = false;

/**
 * Registers the foreground "notification received" and "notification
 * tapped" listeners, and checks for a cold-start tap (app fully killed,
 * opened by tapping the alert). Call once, near app boot.
 */
export function attachNearbyAlertListeners(): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  if (_listenersAttached) return () => {};
  _listenersAttached = true;

  // Keep the alert visible (heads-up banner) even while the app is
  // foregrounded — the default expo-notifications behavior suppresses this.
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    if (__DEV__) console.warn('[nearbyAlert] setNotificationHandler failed:', e);
  }

  const subs: { remove: () => void }[] = [];
  try {
    subs.push(
      Notifications.addNotificationReceivedListener((event) => {
        handleIncomingPush(event.request?.content?.data);
      }),
    );
    subs.push(
      Notifications.addNotificationResponseReceivedListener((event) => {
        handleIncomingPush(event.notification?.request?.content?.data);
      }),
    );
  } catch (e) {
    if (__DEV__) console.warn('[nearbyAlert] failed to attach notification listeners:', e);
  }

  // Cold start: the app was fully killed and the user tapped the alert.
  try {
    const last = Notifications.getLastNotificationResponse();
    if (last) handleIncomingPush(last.notification?.request?.content?.data);
  } catch (e) {
    if (__DEV__) console.warn('[nearbyAlert] getLastNotificationResponse failed:', e);
  }

  return () => {
    subs.forEach((s) => {
      try {
        s.remove();
      } catch {
        // ignore
      }
    });
    _listenersAttached = false;
  };
}
