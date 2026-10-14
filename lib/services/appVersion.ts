import { Alert, AppState, Platform, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import client from '@/lib/api/client';
import { getActivePatrol } from '@/lib/services/patrolDb';

/**
 * Tells the server which app version this login runs (Guard Device Token,
 * upande_security.api.app_devices.report_app_version), on every login and
 * every return to the foreground - at most once every 30 minutes. Security
 * heads see from there who is outdated and can push an update, which lands
 * in applyPushedUpdate() below.
 */

const REPORT_INTERVAL_MS = 30 * 60 * 1000;
let _lastReport = 0;

function deviceModel(): string {
  const c = Platform.constants as { Manufacturer?: string; Model?: string; Brand?: string };
  const model = [c.Manufacturer ?? c.Brand, c.Model].filter(Boolean).join(' ');
  return model || Constants.deviceName || '';
}

export async function reportAppVersion(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - _lastReport < REPORT_INTERVAL_MS) return;
  _lastReport = now;
  try {
    const embedded = Updates.isEmbeddedLaunch;
    await client.post('/api/method/upande_security.api.app_devices.report_app_version', {
      app_version: Constants.expoConfig?.version ?? '',
      runtime_version: Updates.runtimeVersion ?? Constants.expoConfig?.version ?? '',
      update_id: Updates.updateId ?? '',
      // The original install has no published update of its own.
      update_created_at: !embedded && Updates.createdAt ? Updates.createdAt.toISOString() : '',
      update_channel: Updates.channel ?? '',
      is_embedded_launch: embedded ? 1 : 0,
      device_model: deviceModel(),
      os_version: String(Platform.Version ?? ''),
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
  } catch (e) {
    // Best-effort; retry on the next foreground.
    _lastReport = 0;
    if (__DEV__) console.warn('[appVersion] report failed:', e);
  }
}

let _sub: NativeEventSubscription | null = null;

/** Report now and on every return to the foreground. Idempotent. */
export function startAppVersionReporting(): () => void {
  reportAppVersion(true).catch(() => {});
  if (!_sub) {
    _sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') reportAppVersion().catch(() => {});
    });
  }
  return () => {
    _sub?.remove();
    _sub = null;
  };
}

let _applying = false;
let _restartOnResume: NativeEventSubscription | null = null;

/**
 * An "app_update" push from a security head: download the update now and
 * restart into it. The guard can put the restart off (e.g. mid check-in);
 * it then happens the next time the app comes back to the foreground. A
 * running patrol is never interrupted - its background tracking would be
 * orphaned by a reload - so the update waits for the next app start.
 */
export async function applyPushedUpdate(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled || _applying) return;
  _applying = true;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) {
      reportAppVersion(true).catch(() => {});
      return;
    }
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) return;

    const active = await getActivePatrol().catch(() => null);
    if (active && !active.stoppedAt) {
      Alert.alert('Update downloaded', 'It will be installed the next time the app starts, after your patrol.');
      return;
    }
    Alert.alert('Update ready', 'A new version of the app has been downloaded.', [
      { text: 'Later', style: 'cancel', onPress: restartOnNextResume },
      { text: 'Restart now', onPress: () => Updates.reloadAsync().catch(() => {}) },
    ]);
  } catch (e) {
    console.warn('[appVersion] pushed update failed:', e);
  } finally {
    _applying = false;
  }
}

function restartOnNextResume(): void {
  if (_restartOnResume) return;
  let wentAway = false;
  _restartOnResume = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state !== 'active') {
      wentAway = true;
      return;
    }
    if (wentAway) {
      _restartOnResume?.remove();
      _restartOnResume = null;
      Updates.reloadAsync().catch(() => {});
    }
  });
}
