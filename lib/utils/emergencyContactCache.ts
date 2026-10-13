import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage, StorageKeys } from '@/src/core/storage';

// Kept apart from emergencyCall.ts, which imports the API client: authStore
// needs clearEmergencyContact, and the client imports authStore, so pulling
// it from emergencyCall.ts would close an import cycle.

export const CACHED_CONTACT_KEY = 'emergency_contact_number';
export const CACHED_COMPANY_KEY = 'emergency_contact_company';
/**
 * Which site + login the cached number was fetched for. A gate phone is
 * shared across guards and sometimes pointed at staging, so a number cached
 * for one login must never be dialled for another - that is exactly how
 * guards ended up ringing long-replaced numbers after Security Ops Settings
 * had been corrected.
 */
export const CACHED_OWNER_KEY = 'emergency_contact_owner';

export async function currentOwner(): Promise<string> {
  const [url, email] = await Promise.all([
    storage.get(StorageKeys.instanceUrl),
    storage.get(StorageKeys.emailBackup),
  ]);
  return (url ?? '') + '|' + (email ?? '');
}

/** Forget the cached number. Called on logout, and when the server says this
 *  login has no contact at all. */
export async function clearEmergencyContact(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([CACHED_CONTACT_KEY, CACHED_COMPANY_KEY, CACHED_OWNER_KEY]);
  } catch {
    // Nothing useful to do - resolveEmergencyNumber still refuses a
    // number cached for a different owner.
  }
}
