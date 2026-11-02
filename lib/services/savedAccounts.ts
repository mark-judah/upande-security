import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Biometric from '@/src/core/biometric';

/**
 * Accounts saved on this phone for fingerprint sign-in.
 *
 * Gate phones are shared and guards forget the site URL and their password,
 * so after a password sign-in the app offers to save the account: the login
 * screen then lists the guards saved on the phone, and a tap plus a
 * fingerprint signs that guard in - a real sign-in with the saved password,
 * so it works however long ago the last session expired.
 *
 * The list (name, email, site) is not secret and lives in AsyncStorage. Each
 * password lives in the Android Keystore via expo-secure-store with
 * requireAuthentication: the key can only be used after a successful
 * fingerprint, checked by the system, not by this code. Android voids such a
 * key when the phone's enrolled fingerprints change; that account then asks
 * for its password once and is saved again.
 *
 * The phone cannot tell whose finger it is - any finger enrolled on it opens
 * any saved account. Saving is the guard's choice at sign-in for that reason.
 */

export type SavedAccount = {
  id: string;
  email: string;
  fullName: string;
  site: string;
  savedAt: string;
};

const LIST_KEY = 'savedAccounts:v1';
const LAST_SITE_KEY = 'savedAccounts:lastSite';

type SecureStoreModule = typeof import('expo-secure-store');

let secure: SecureStoreModule | null | undefined;
/** Null on a build without the native module (an APK from before it). */
function secureStore(): SecureStoreModule | null {
  if (secure !== undefined) return secure;
  try {
    secure = requireOptionalNativeModule('ExpoSecureStore')
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- must not load without the native module
        (require('expo-secure-store') as SecureStoreModule)
      : null;
  } catch {
    secure = null;
  }
  return secure;
}

/** Secure-store keys allow only [A-Za-z0-9._-]. */
const accountId = (email: string, site: string) =>
  (email.trim().toLowerCase() + '@' + site.replace(/^https?:\/\//i, '').toLowerCase()).replace(
    /[^A-Za-z0-9._-]/g,
    '_',
  );

const passwordKey = (id: string) => 'pw.' + id;

/** This build and phone can save accounts: secure storage present and a fingerprint enrolled. */
export async function canSaveAccounts(): Promise<boolean> {
  return secureStore() !== null && (await Biometric.isAvailable());
}

export async function listSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(LIST_KEY);
    const list = raw ? (JSON.parse(raw) as SavedAccount[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeList(list: SavedAccount[]) {
  await AsyncStorage.setItem(LIST_KEY, JSON.stringify(list));
}

export async function isSaved(email: string, site: string): Promise<boolean> {
  const id = accountId(email, site);
  return (await listSavedAccounts()).some((a) => a.id === id);
}

/**
 * Save (or re-save) an account. Writing a fingerprint-bound key shows the
 * fingerprint prompt, so this only succeeds with a finger the phone accepts.
 */
export async function saveAccount(a: {
  email: string;
  fullName: string;
  site: string;
  password: string;
}): Promise<SavedAccount> {
  const store = secureStore();
  if (!store) throw new Error('This app version cannot save accounts. Update the app.');
  const id = accountId(a.email, a.site);
  await store.setItemAsync(passwordKey(id), a.password, {
    requireAuthentication: true,
    authenticationPrompt: 'Confirm your fingerprint to save ' + (a.fullName || a.email),
  });
  const entry: SavedAccount = {
    id,
    email: a.email.trim(),
    fullName: a.fullName || a.email.trim(),
    site: a.site,
    savedAt: new Date().toISOString(),
  };
  const list = (await listSavedAccounts()).filter((x) => x.id !== id);
  await writeList([entry, ...list]);
  return entry;
}

/** The saved password after a fingerprint, or null if cancelled. Throws
 *  'invalidated' when Android voided the key (fingerprints changed). */
export async function unlockPassword(account: SavedAccount): Promise<string | null> {
  const store = secureStore();
  if (!store) throw new Error('This app version cannot use saved accounts. Update the app.');
  try {
    return await store.getItemAsync(passwordKey(account.id), {
      requireAuthentication: true,
      authenticationPrompt: 'Sign in as ' + account.fullName,
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    if (msg.includes('cancel')) return null;
    if (msg.includes('invalidat') || msg.includes('key permanently') || msg.includes('decrypt')) {
      throw new Error('invalidated');
    }
    throw e;
  }
}

export async function removeAccount(id: string): Promise<void> {
  const store = secureStore();
  if (store) await store.deleteItemAsync(passwordKey(id)).catch(() => {});
  await writeList((await listSavedAccounts()).filter((a) => a.id !== id));
}

/** The last site signed in to on this phone, so the form never needs it typed twice. */
export async function getLastSite(): Promise<string> {
  return (await AsyncStorage.getItem(LAST_SITE_KEY).catch(() => null)) ?? '';
}

export async function setLastSite(site: string): Promise<void> {
  await AsyncStorage.setItem(LAST_SITE_KEY, site).catch(() => {});
}
