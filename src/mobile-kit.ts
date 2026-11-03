/**
 * Describes this app to @upande/mobile-kit. Imported once, first thing, by
 * app/_layout.tsx. Written by `npx upande-mobile-kit init`.
 *
 * `useAuth`, `api` and `storage` should be the app's OWN (init wires them when it
 * can find them): on the kit's stand-ins the Settings page looks fine, but
 * sign-out, the biometric switch and the device register are not connected to
 * the real session.
 */
import { configureMobileKit, type KitApi, type KitAuth } from '@upande/mobile-kit';
import axios from 'axios';
import { useAuthStore } from '../lib/stores/authStore';
import { storage as hostStorage, StorageKeys } from './core/storage';

// The kit wants a generic request function that resolves to the response BODY.
// Deliberately NOT `lib/api/client.ts`: that client's interceptors call
// router.replace('/login') when there is no cookie and wipe the session on any
// 401/403. The kit's calls are best-effort background work (device register,
// crash reports) and must never navigate or sign anyone out - with the shared
// client, a kit call made on the login screen re-mounted it on every retry.
const hostApi: KitApi = async (req) => {
  const [baseURL, cookie] = await Promise.all([
    hostStorage.get(StorageKeys.instanceUrl),
    hostStorage.get(StorageKeys.cookie),
  ]);
  if (!baseURL || !cookie) throw new Error('Not signed in');
  const res = await axios.request({
    baseURL,
    method: req.method,
    url: req.url,
    params: req.params,
    data: req.data,
    timeout: 30000,
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': 'token',
    },
  });
  return res.data;
};

function useHostAuth(): KitAuth {
  const user = useAuthStore((s) => s.user);
  const hasSession = useAuthStore((s) => s.hasSession);
  const instanceUrl = useAuthStore((s) => s.instanceUrl);
  const roles = useAuthStore((s) => s.roles);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const logout = useAuthStore((s) => s.logout);
  const forgetDevice = useAuthStore((s) => s.forgetDevice);
  return {
    isSystemManager: roles.includes('System Manager'),
    roles,
    // `user` is the saved email even on the login screen (used to pre-fill it), so
    // only report an account to the kit while a session actually exists.
    email: hasSession ? (user?.email ?? null) : null,
    user: hasSession ? (user?.email ?? null) : null,
    instanceUrl,
    biometricEnabled,
    setBiometricEnabled,
    logout,
    forgetDevice,
  };
}

configureMobileKit({
  appName: 'Upande Security', // the "Mobile App" record on the server
  githubRepo: 'mark-judah/upande-security', // owner/repo that publishes the GitHub Releases (APKs)
  site: { production: 'https://kaitet-group.upande.com', development: 'http://10.78.203.154:8002' },
  // Dev builds (Metro / dev client, __DEV__) talk to `development`; release builds to `production`.
  // Pin one with `environment: 'production'`. localhost works in the iOS simulator; the Android emulator needs http://10.0.2.2:<port>, a real phone your computer's LAN address.
  biometric: 'host', // your app already locks itself with expo-local-authentication; the kit adds no lock of its own
  // Not forced, not auto-downloaded, until CI signs APKs with the release key the
  // phones were installed with: a debug-signed APK cannot install over them, and a
  // forced one locked the app ("Update required" over a failing installer).
  apk: { autoDownload: 'never', force: false },
  //
  // Crash & API monitoring is ON by default. The person can turn it off in Settings. Defaults shown:
  // monitor: {
  //   enabled: true,            // false installs nothing
  //   captureBodies: true,      // request/response bodies of FAILED calls (secrets redacted, capped)
  //   maxBodyBytes: 8192,
  //   redactKeys: [],           // extra key names to hide, on top of password/token/authorization/cookie/...
  //   ignoreUrls: [],           // strings or RegExps never recorded
  //   sampleSuccess: 0,         // 0-1: share of successful calls recorded (metadata only)
  //   breadcrumbs: 30,
  //   consoleBreadcrumbs: false,
  //   errorBoundary: false,     // true wraps the app in <MonitorErrorBoundary>
  //   showToggle: true,         // the "Send crash reports" row in Settings
  // },
  //
  // Wired to this app's own modules (found by `npx upande-mobile-kit init`):
  api: hostApi, // must resolve to the response BODY ({ message } for whitelisted methods)
  storage: hostStorage,
  //
  useAuth: useHostAuth,
  //
  // Still on the kit's stand-ins (uncomment to wire them):
  // theme: { primary: '#...' },
});
