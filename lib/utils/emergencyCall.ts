import { Linking, PermissionsAndroid, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/services/api';

const CACHED_CONTACT_KEY = 'emergency_contact_number';
const CACHED_COMPANY_KEY = 'emergency_contact_company';

// Baked-in fallback per company — used only when this device has never once
// successfully synced a live contact from get_security_head_contact.py (e.g.
// a brand-new phone with no connectivity yet on its very first SOS). The
// live lookup is always preferred and re-cached whenever it succeeds; this
// table exists purely so an actual emergency never falls back to a fake
// placeholder number. Update here AND confirm the matching User Permission /
// Security Head role is still correct on the server when a contact changes.
const COMPANY_EMERGENCY_CONTACTS: Record<string, string> = {
  'Karen Roses': '0718253145', // Jomo Kamao
  'Kaitet Group': '+254721320226', // Elvis Koskei
  'Kaitet Ltd.': '+254721320226', // Elvis Koskei
};

// Absolute last resort — used only if there's no cached live contact AND no
// cached company to look up in the table above (e.g. this device has never
// once reached the server at all).
export const EMERGENCY_CONTACT_NUMBER = '+254700000000';

export type EmergencyCallResult =
  | { placed: true; method: 'auto' }
  | { placed: false; method: 'dialer'; reason: 'ios' | 'permission_denied' | 'launch_failed' };

/**
 * Fetches the on-duty Security Head's phone for this guard's company/farm
 * and caches it locally, so an actual SOS never waits on the network —
 * callEmergencyNumber() only ever reads the cache, never calls the API
 * directly. Call this on app start / SOS-watcher mount; safe to call
 * repeatedly and safe to fail silently (falls back to whatever was cached
 * before, or the hardcoded default).
 */
export async function refreshEmergencyContact(): Promise<void> {
  try {
    const contact = await api.getSecurityHeadContact();
    if (contact?.phone) {
      await AsyncStorage.setItem(CACHED_CONTACT_KEY, contact.phone);
    }
    if (contact?.company) {
      await AsyncStorage.setItem(CACHED_COMPANY_KEY, contact.company);
    }
  } catch {
    // No Security Head configured for this company/farm yet, or offline —
    // keep whatever was cached before.
  }
}

async function resolveEmergencyNumber(): Promise<string> {
  try {
    const cached = await AsyncStorage.getItem(CACHED_CONTACT_KEY);
    if (cached) return cached;
  } catch {
    // fall through
  }
  // No live contact ever cached — try the baked-in per-company fallback
  // before giving up to the generic placeholder.
  try {
    const company = await AsyncStorage.getItem(CACHED_COMPANY_KEY);
    if (company && COMPANY_EMERGENCY_CONTACTS[company]) {
      return COMPANY_EMERGENCY_CONTACTS[company];
    }
  } catch {
    // fall through to the hardcoded default
  }
  return EMERGENCY_CONTACT_NUMBER;
}

/**
 * Ask for CALL_PHONE up front (e.g. when the SOS listener mounts) so the
 * permission prompt doesn't add latency to an actual emergency later.
 * No-op on iOS, where this permission doesn't exist.
 */
export async function requestCallPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
    if (already) return true;
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE, {
      title: 'Emergency call permission',
      message:
        'Upande Security needs permission to call your supervisor directly when you trigger an SOS alert.',
      buttonPositive: 'Allow',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Places an emergency call.
 *
 * Android, with CALL_PHONE granted: dials immediately via Intent.ACTION_CALL
 * — no tap required. This is the only platform where that's possible; iOS
 * has no API to bypass its own call-confirmation prompt, by design.
 *
 * Every other case (iOS, or Android without the permission) falls back to
 * opening the dialer pre-filled via `tel:`, which still requires one tap on
 * "Call" — the best available option there.
 */
export async function callEmergencyNumber(phoneNumber?: string): Promise<EmergencyCallResult> {
  const number = phoneNumber ?? (await resolveEmergencyNumber());

  if (Platform.OS === 'android') {
    const granted = await requestCallPermission();
    if (granted) {
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.CALL', {
          data: 'tel:' + number,
        });
        return { placed: true, method: 'auto' };
      } catch {
        // Fall through to the dialer fallback below.
      }
    } else {
      await Linking.openURL('tel:' + number).catch(() => {});
      return { placed: false, method: 'dialer', reason: 'permission_denied' };
    }
  }

  await Linking.openURL('tel:' + number).catch(() => {});
  return {
    placed: false,
    method: 'dialer',
    reason: Platform.OS === 'ios' ? 'ios' : 'launch_failed',
  };
}
