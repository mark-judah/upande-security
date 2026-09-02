import { Linking, PermissionsAndroid, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/services/api';

const CACHED_CONTACT_KEY = 'emergency_contact_number';
const CACHED_COMPANY_KEY = 'emergency_contact_company';

export type EmergencyCallResult =
  | { placed: true; method: 'auto' }
  | { placed: false; method: 'dialer'; reason: 'ios' | 'permission_denied' | 'launch_failed' }
  | { placed: false; method: 'no_contact' };

/**
 * Fetches the on-duty Security Head's (or Security Ops Settings' configured
 * fallback) phone for this guard's company/farm and caches it locally, so
 * an actual SOS never waits on the network — callEmergencyNumber() only
 * ever reads the cache, never calls the API directly. Call this on app
 * start / SOS-watcher mount; safe to call repeatedly and safe to fail
 * silently (falls back to whatever was cached before).
 *
 * There is deliberately no number baked into the app itself — every
 * contact this ever resolves to comes from the server (a real Security
 * Head's User record, or a row in Security Ops Settings > Fallback
 * Contacts), so changing a company's contact on the server is enough;
 * nothing in this file ever needs updating to match.
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
    // No Security Head/fallback configured for this company/farm yet
    // (get_security_head_contact.py itself now falls back to a random
    // guard's company when this login isn't linked to one, so a real
    // error here means Security Ops Settings genuinely has nothing
    // configured for any company), or offline — keep whatever was
    // cached before.
  }
}

/** Null when no live contact has ever been cached — see callEmergencyNumber. */
async function resolveEmergencyNumber(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CACHED_CONTACT_KEY);
  } catch {
    return null;
  }
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
 *
 * If no contact has ever been cached (this device has never once reached
 * get_security_head_contact.py — no network at every login so far), there
 * is no baked-in placeholder to fall back to: dialing a number frozen in
 * app code could ring someone who is no longer the right contact, or isn't
 * even at this company. Opening a blank dialer is the safer failure — the
 * guard sees no pre-filled number and knows to dial manually / use another
 * channel, rather than an automatic call silently reaching the wrong
 * person.
 */
export async function callEmergencyNumber(phoneNumber?: string): Promise<EmergencyCallResult> {
  const number = phoneNumber ?? (await resolveEmergencyNumber());

  if (!number) {
    await Linking.openURL('tel:').catch(() => {});
    return { placed: false, method: 'no_contact' };
  }

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
