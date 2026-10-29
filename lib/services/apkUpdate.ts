import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { getActivePatrol } from '@/lib/services/patrolDb';

/**
 * A new APK, for what an over-the-air update cannot carry (a native change,
 * a new runtime). The server names the newest build (Security Ops Settings >
 * Mobile App Release, handed back by report_app_version as latest_apk); a
 * phone on an older one downloads it and opens Android's install screen.
 *
 * Android never lets a sideloaded app replace itself silently - the guard
 * taps Update on the system screen (the first time, Android also asks to
 * allow installs from this app). Everything before that tap is automatic:
 * - on Wi-Fi the APK downloads in the background; on mobile data the guard
 *   is asked first (it is ~85 MB), unless the release is compulsory;
 * - once downloaded: "Install" opens the installer; "Later" (not offered for
 *   a compulsory release) asks again after LATER_MS;
 * - never during a running patrol - replacing the app would end its
 *   background tracking.
 */

export type LatestApk = { version: string; url: string; required?: number | boolean; notes?: string };

const LATER_MS = 6 * 60 * 60 * 1000;
const LATER_KEY = 'apkUpdate:laterUntil';
const APK_DIR = (FileSystem.cacheDirectory ?? '') + 'apk-updates/';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

let busy = false;

/** 1.2.10 > 1.2.9; missing parts count as 0. */
export function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split('.').map((n) => parseInt(n, 10) || 0);
  const b = current.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

/** The installed APK's own version (not the over-the-air bundle's). */
const installedVersion = () => Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '0';

const ask = (title: string, message: string, buttons: { text: string; value: boolean }[]) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      buttons.map((b) => ({ text: b.text, onPress: () => resolve(b.value), style: b.value ? 'default' : 'cancel' })),
      { cancelable: false },
    ),
  );

async function download(apk: LatestApk): Promise<string> {
  const file = `${APK_DIR}upande-security-${apk.version}.apk`;
  const done = await FileSystem.getInfoAsync(file);
  if (done.exists && (done.size ?? 0) > 1_000_000) return file;
  await FileSystem.makeDirectoryAsync(APK_DIR, { intermediates: true }).catch(() => {});
  // Older versions' files are no longer needed.
  for (const name of await FileSystem.readDirectoryAsync(APK_DIR).catch(() => [] as string[])) {
    await FileSystem.deleteAsync(APK_DIR + name, { idempotent: true }).catch(() => {});
  }
  // To a .part file first, so an interrupted download is never mistaken for a whole one.
  const part = file + '.part';
  const res = await FileSystem.downloadAsync(apk.url, part);
  if (res.status !== 200) throw new Error('APK download failed: HTTP ' + res.status);
  await FileSystem.moveAsync({ from: part, to: file });
  return file;
}

async function openInstaller(file: string) {
  const uri = await FileSystem.getContentUriAsync(file);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: uri,
    type: 'application/vnd.android.package-archive',
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}

/** Called with the server's latest_apk on every version report. */
export async function offerApkUpdate(apk: LatestApk | null | undefined): Promise<void> {
  if (Platform.OS !== 'android' || __DEV__ || busy) return;
  if (!apk?.version || !apk.url || !isNewer(apk.version, installedVersion())) return;
  const required = !!apk.required;
  busy = true;
  try {
    if (!required) {
      const until = Number(await AsyncStorage.getItem(LATER_KEY).catch(() => null)) || 0;
      if (Date.now() < until) return;
    }
    const active = await getActivePatrol().catch(() => null);
    if (active && !active.stoppedAt) return;

    const net = await NetInfo.fetch();
    if (!net.isConnected) return;
    if (net.type !== 'wifi' && !required) {
      const go = await ask(
        'App update available',
        `Version ${apk.version} is ready to download (about 85 MB). Download it now on mobile data?`,
        [
          { text: 'Later', value: false },
          { text: 'Download', value: true },
        ],
      );
      if (!go) {
        await AsyncStorage.setItem(LATER_KEY, String(Date.now() + LATER_MS)).catch(() => {});
        return;
      }
    }

    const file = await download(apk);
    const notes = apk.notes ? `\n\n${apk.notes}` : '';
    const install = await ask(
      required ? 'Update required' : 'App update ready',
      `Version ${apk.version} has downloaded. Tap Install, then Update on the next screen.${notes}`,
      required
        ? [{ text: 'Install', value: true }]
        : [
            { text: 'Later', value: false },
            { text: 'Install', value: true },
          ],
    );
    if (!install) {
      await AsyncStorage.setItem(LATER_KEY, String(Date.now() + LATER_MS)).catch(() => {});
      return;
    }
    await openInstaller(file);
  } catch (e) {
    if (__DEV__) console.warn('[apkUpdate]', e);
  } finally {
    busy = false;
  }
}
