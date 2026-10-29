import { AppState, Platform, ToastAndroid, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import client from '@/lib/api/client';
import { getActivePatrol } from '@/lib/services/patrolDb';
import { offerApkUpdate } from '@/lib/services/apkUpdate';

/**
 * Tells the server which app version this login runs (Guard Device Token,
 * upande_security.api.app_devices.report_app_version), on every login and
 * every return to the foreground - at most once every 30 minutes. Security
 * heads see from there who is outdated and can push an update, which lands
 * in applyPushedUpdate() below. The reply also names the newest APK, which
 * apkUpdate.ts downloads and offers when this install is older.
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
    const res = await client.post('/api/method/upande_security.api.app_devices.report_app_version', {
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
    // A newer APK than this install (native changes an OTA can't carry).
    offerApkUpdate(res.data?.message?.latest_apk).catch(() => {});
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
  startPushedUpdateHandling();
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

// Seconds between "Updating the app" and the restart when the app is open.
const RESTART_DELAY_MS = 8000;
// Set by the background task when it downloaded a pushed update while the
// app was not on screen; the next return to the foreground restarts into it.
const PENDING_KEY = 'appVersion:pushedUpdatePending';
export const BACKGROUND_UPDATE_TASK = 'pushed-app-update';

/**
 * An "app_update" push from a security head installs itself - nobody taps:
 * - app on screen: download, show "Updating the app", restart a few seconds
 *   later;
 * - app in the background: restart into it the next time it comes back;
 * - app not running or the phone locked: the background task below
 *   downloads it, and it starts with the next launch or return to the app.
 * A running patrol is never interrupted - its background tracking would be
 * orphaned by a reload - so then the update waits for the next app start.
 */
export async function applyPushedUpdate(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled || _applying) return;
  _applying = true;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) {
      await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
      reportAppVersion(true).catch(() => {});
      return;
    }
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) return;
    await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});

    const active = await getActivePatrol().catch(() => null);
    if (active && !active.stoppedAt) {
      notify('Update downloaded - it installs the next time the app starts, after your patrol.');
      return;
    }
    if (AppState.currentState === 'active') {
      notify('Updating the app - it restarts in a few seconds.');
      setTimeout(() => Updates.reloadAsync().catch(() => {}), RESTART_DELAY_MS);
    } else {
      restartOnNextResume();
    }
  } catch (e) {
    console.warn('[appVersion] pushed update failed:', e);
  } finally {
    _applying = false;
  }
}

function notify(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.LONG);
  else console.log('[appVersion] ' + message);
}

function restartOnNextResume(): void {
  if (_restartOnResume) return;
  // Already in the background: the next "active" is the return.
  let wentAway = AppState.currentState !== 'active';
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

// --- Push while the app is not on screen --------------------------------------
// Android hands a data-only push to this task even when the app is in the
// background or not running. It downloads the update and leaves a flag; the
// download itself makes the next cold start use it, and the flag makes the
// next return to the foreground restart into it.
function isAppUpdatePush(payload: unknown): boolean {
  try {
    return JSON.stringify(payload ?? '').includes('app_update');
  } catch {
    return false;
  }
}

TaskManager.defineTask(BACKGROUND_UPDATE_TASK, async ({ data, error }) => {
  if (error || !isAppUpdatePush(data) || !Updates.isEnabled) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    const fetched = await Updates.fetchUpdateAsync();
    if (fetched.isNew) await AsyncStorage.setItem(PENDING_KEY, '1');
  } catch (e) {
    if (__DEV__) console.warn('[appVersion] background update failed:', e);
  }
});

let _bgRegistered = false;
let _pendingSub: NativeEventSubscription | null = null;

/** Register the background update task and apply a pending one on return. */
export function startPushedUpdateHandling(): void {
  if (!_bgRegistered) {
    _bgRegistered = true;
    Notifications.registerTaskAsync(BACKGROUND_UPDATE_TASK).catch(() => {
      _bgRegistered = false;
    });
  }
  const applyPending = async () => {
    const pending = await AsyncStorage.getItem(PENDING_KEY).catch(() => null);
    if (pending) applyPushedUpdate().catch(() => {});
  };
  applyPending();
  if (!_pendingSub) {
    _pendingSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') applyPending();
    });
  }
}
