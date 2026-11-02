import { AppState, Platform, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import client from '@/lib/api/client';

/**
 * Tells the server which app version this login runs (Guard Device Token,
 * upande_security.api.app_devices.report_app_version), on every login and
 * every return to the foreground - at most once every 30 minutes. Security
 * heads see from there who is outdated. This only REPORTS: installing JS
 * (OTA) updates belongs to @upande/mobile-kit alone, so nothing here may
 * check for, fetch or apply one, and neither may APK updates (also the kit's).
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
