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
import client from '../lib/api/client';
import { useAuthStore } from '../lib/stores/authStore';
import { storage as hostStorage } from './core/storage';

// The kit wants a generic request function that resolves to the response BODY.
// `lib/services/api.ts` is a set of per-verb methods, so use the shared axios
// client instead: it already attaches the instance URL + session cookie and
// turns 401/403 into a re-login.
const hostApi: KitApi = async (req) => {
  const res = await client.request({
    method: req.method,
    url: req.url,
    params: req.params,
    data: req.data,
  });
  return res.data;
};

function useHostAuth(): KitAuth {
  const user = useAuthStore((s) => s.user);
  const instanceUrl = useAuthStore((s) => s.instanceUrl);
  const roles = useAuthStore((s) => s.roles);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const logout = useAuthStore((s) => s.logout);
  const forgetDevice = useAuthStore((s) => s.forgetDevice);
  return {
    isSystemManager: roles.includes('System Manager'),
    roles,
    email: user?.email ?? null,
    user: user?.email ?? null,
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
  // apk: { autoDownload: 'wifi' }, // 'wifi' (default) | 'always' | 'never'
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
