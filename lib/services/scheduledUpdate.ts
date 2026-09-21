import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

/**
 * Automatic OTA update check + apply, once a day, inside a fixed off-hours
 * window — replaces relying on someone remembering to tap "Check for
 * Updates" in Settings.
 *
 * Deliberately scheduled at 21:00 (a quiet hour, not mid-shift) rather than
 * on every app launch/foreground: this app runs on a device that's largely
 * always-open at the gate, so a launch-only check (expo-updates' own
 * ON_LOAD default) could go days without ever firing. Applying automatically
 * at a known, low-traffic time — instead of only downloading and waiting for
 * a manual reload — is the whole point: if a bad update is going to crash
 * the app, better it happens at 21:00 under watch than mid-afternoon during
 * real gate operations. The manual "Check for Updates" button in Settings
 * stays as-is for anyone who wants to apply sooner.
 */

const TARGET_HOUR = 21; // 21:00 local time
const WINDOW_MINUTES = 20; // fires once somewhere in [21:00, 21:20)
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes, matches locationPing.ts's cadence
const LAST_RUN_KEY = 'scheduledUpdate:lastRunDate';

function todayKey(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function inWindow(d: Date): boolean {
  if (d.getHours() !== TARGET_HOUR) return false;
  return d.getMinutes() < WINDOW_MINUTES;
}

async function alreadyRanToday(d: Date): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(LAST_RUN_KEY);
    return last === todayKey(d);
  } catch {
    return false;
  }
}

async function markRanToday(d: Date): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_RUN_KEY, todayKey(d));
  } catch {
    // best-effort — worst case this retries again within the same window
  }
}

let _ticking = false;

async function tick(): Promise<void> {
  if (_ticking) return;
  if (__DEV__) return; // OTA updates are unavailable in development, same as the manual check
  if (!Updates.isEnabled) return;

  const now = new Date();
  if (!inWindow(now)) return;
  if (await alreadyRanToday(now)) return;

  _ticking = true;
  try {
    console.log('[scheduledUpdate] 21:00 window — checking for an update');
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) {
      console.log('[scheduledUpdate] no update available');
      await markRanToday(now);
      return;
    }

    console.log('[scheduledUpdate] update available — fetching');
    const fetched = await Updates.fetchUpdateAsync();
    await markRanToday(now);

    if (fetched.isNew) {
      console.log('[scheduledUpdate] fetched a new update — reloading now');
      await Updates.reloadAsync();
    }
  } catch (e) {
    console.warn('[scheduledUpdate] check/apply failed — will retry within the same window:', e);
  } finally {
    _ticking = false;
  }
}

let _interval: ReturnType<typeof setInterval> | null = null;
let _appStateSub: NativeEventSubscription | null = null;

/** Starts the daily scheduled-update watcher. Safe to call multiple times (idempotent). */
export function startScheduledUpdateCheck(): void {
  if (_interval) return;
  tick().catch(() => {});
  _interval = setInterval(() => {
    tick().catch(() => {});
  }, CHECK_INTERVAL_MS);
  // Catches the case where the app was backgrounded right at 21:00 and
  // foregrounds again a few minutes later, still inside the window.
  _appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') tick().catch(() => {});
  });
}

export function stopScheduledUpdateCheck(): void {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
  if (_appStateSub) {
    _appStateSub.remove();
    _appStateSub = null;
  }
}
