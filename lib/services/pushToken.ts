import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { registerPushToken as registerPushTokenApi } from '@/lib/api/sosAlert';

/**
 * Nearby-guard SOS push registration.
 *
 * `expo-notifications` is a real Expo SDK module (unlike the bare
 * react-native-volume-manager module in sos.ts), but this app only just
 * started actually calling into it — a stale/pre-existing dev client build
 * may not have its native code compiled in yet. Resolved lazily with the
 * same try/catch pattern as `getVolumeManager()` in sos.ts so a build
 * without it degrades to a silent no-op instead of crashing on import.
 */
type NotificationsModule = typeof import('expo-notifications');
let _notifications: NotificationsModule | null | undefined;
export function getNotifications(): NotificationsModule | null {
  if (_notifications !== undefined) return _notifications;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _notifications = require('expo-notifications') as NotificationsModule;
  } catch (e) {
    if (__DEV__) {
      console.warn(
        '[pushToken] expo-notifications unavailable — nearby-guard SOS alerts disabled until a dev build that includes it. Error:',
        e,
      );
    }
    _notifications = null;
  }
  return _notifications;
}

/** Must match the server's push payload `channelId: 'sos-alerts'`. */
export const SOS_CHANNEL_ID = 'sos-alerts';

let _channelReady = false;
async function ensureAndroidChannel(Notifications: NotificationsModule): Promise<void> {
  if (_channelReady || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(SOS_CHANNEL_ID, {
      name: 'SOS Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: '#EF4444',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
    _channelReady = true;
  } catch (e) {
    if (__DEV__) console.warn('[pushToken] failed to create sos-alerts channel:', e);
  }
}

let _registering = false;

/**
 * Requests notification permission, fetches this device's Expo push token,
 * and registers it against the logged-in user's linked guard record.
 * Best-effort throughout — never throws, since this can run unattended on
 * app start.
 */
export async function registerForNearbyGuardAlerts(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  if (_registering) return;
  _registering = true;
  try {
    await ensureAndroidChannel(Notifications);

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
        ?.projectId;
    if (!projectId) {
      if (__DEV__) {
        console.warn('[pushToken] no extra.eas.projectId in app config — cannot fetch Expo push token');
      }
      return;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const expo_push_token = tokenResponse.data;
    if (!expo_push_token) return;

    // Best-effort last-known location — never blocks registration.
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        lat = last.coords.latitude;
        lng = last.coords.longitude;
      }
    } catch {
      // ignore — location is optional context for the server record
    }

    await registerPushTokenApi({
      expo_push_token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      lat,
      lng,
    });
  } catch (e) {
    if (__DEV__) console.warn('[pushToken] registration failed:', e);
  } finally {
    _registering = false;
  }
}

let _tokenListener: { remove: () => void } | null = null;

/** Re-registers whenever the underlying device push token rotates. */
export function watchPushTokenRotation(): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  if (_tokenListener) return () => _tokenListener?.remove();
  try {
    _tokenListener = Notifications.addPushTokenListener(() => {
      registerForNearbyGuardAlerts().catch(() => {});
    });
  } catch (e) {
    if (__DEV__) console.warn('[pushToken] failed to attach token rotation listener:', e);
  }
  return () => {
    _tokenListener?.remove();
    _tokenListener = null;
  };
}
