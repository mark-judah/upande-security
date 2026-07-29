import { create } from 'zustand';
import { AppState, type AppStateStatus } from 'react-native';
import { login as apiLogin, logout as apiLogout, fetchUserRoles } from '@/lib/api/auth';
import { storage, StorageKeys } from '@/src/core/storage';
import * as Biometric from '@/src/core/biometric';

type AuthState = {
  // Legacy shape — preserved for existing screens.
  user: { email: string; userId: string } | null;
  instanceUrl: string | null;
  isAuthenticated: boolean;
  /** Frappe roles for the current user — drives the role-gated Approvals tab. */
  roles: string[];

  // New canonical fields.
  hydrated: boolean;
  hasSession: boolean;
  /** Per-device biometric setting. Persisted as '0'/'1'. */
  biometricEnabled: boolean;
  /** Runtime gate — true when the app should show the biometric lock screen. */
  biometricLocked: boolean;

  // Actions.
  hydrate: () => Promise<void>;
  login: (url: string, email: string, password: string) => Promise<void>;
  /** Soft logout — clear in-memory session but keep cookie + biometric flag
   *  so the user can biometric-unlock back in. */
  logout: () => Promise<void>;
  /** Hard logout — wipe everything. Used on 401 and "Forget device". */
  forgetDevice: () => Promise<void>;
  setBiometricEnabled: (on: boolean) => Promise<void>;
  /** Called after a successful biometric prompt. */
  unlock: () => void;
};

let appStateSub: { remove: () => void } | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  instanceUrl: null,
  isAuthenticated: false,
  roles: [],

  hydrated: false,
  hasSession: false,
  biometricEnabled: false,
  biometricLocked: false,

  hydrate: async () => {
    const [emailBackup, legacyEmail, url, cookie, bioFlag, rolesJson] = await Promise.all([
      storage.get(StorageKeys.emailBackup),
      storage.get('user_email'), // legacy key written by lib/api/auth.ts; one-time migration
      storage.get(StorageKeys.instanceUrl),
      storage.get(StorageKeys.cookie),
      storage.get(StorageKeys.biometricEnabled),
      storage.get(StorageKeys.userRoles),
    ]);
    let email = emailBackup;
    if (!email && legacyEmail) {
      email = legacyEmail;
      // Backfill into the canonical key so subsequent reads find it.
      await storage.set(StorageKeys.emailBackup, legacyEmail);
    }
    const hasSession = !!(cookie && url);
    const biometricEnabled = bioFlag === '1';
    const biometricLocked =
      hasSession && biometricEnabled && Biometric.isModuleAvailable();
    let roles: string[] = [];
    if (rolesJson) {
      try {
        roles = JSON.parse(rolesJson);
      } catch {
        roles = [];
      }
    }

    set({
      user: email ? { email, userId: '' } : null,
      instanceUrl: url,
      isAuthenticated: hasSession,
      hasSession,
      hydrated: true,
      biometricEnabled,
      biometricLocked,
      roles,
    });

    // Re-lock on foreground. Subscribe once.
    if (!appStateSub) {
      appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
        if (next !== 'active') return;
        const s = get();
        if (s.hasSession && s.biometricEnabled && Biometric.isModuleAvailable()) {
          set({ biometricLocked: true });
        }
      });
    }
  },

  login: async (url, email, password) => {
    const result = await apiLogin(email, password, url);
    // Persist the email so we can pre-fill it next time.
    await storage.set(StorageKeys.emailBackup, email);
    // Fetch roles immediately after login so Approvals tab visibility is correct.
    const roles = await fetchUserRoles(result.fullUrl, email);
    await storage.set(StorageKeys.userRoles, JSON.stringify(roles));
    set({
      user: { email, userId: result.userId ?? '' },
      instanceUrl: result.fullUrl,
      isAuthenticated: true,
      hasSession: true,
      // A fresh password login never lands on the biometric lock screen.
      biometricLocked: false,
      roles,
    });
  },

  logout: async () => {
    // Soft logout — keeps cookie + biometric flag so the user can return via
    // biometric unlock. forgetDevice() is the hard variant.
    await apiLogout();
    set({
      user: null,
      isAuthenticated: false,
      hasSession: false,
      biometricLocked: false,
    });
  },

  forgetDevice: async () => {
    await apiLogout();
    // Drop biometric flag, cached personal data, and the session itself —
    // hard logout must not leave a cookie/instanceUrl behind for the next
    // hydrate() to silently pick back up.
    await Promise.all([
      storage.remove(StorageKeys.biometricEnabled),
      storage.remove(StorageKeys.emailBackup),
      storage.remove(StorageKeys.cookie),
      storage.remove(StorageKeys.instanceUrl),
      storage.remove(StorageKeys.userRoles),
    ]);
    set({
      user: null,
      instanceUrl: null,
      isAuthenticated: false,
      hasSession: false,
      biometricEnabled: false,
      biometricLocked: false,
      roles: [],
    });
  },

  setBiometricEnabled: async (on) => {
    await storage.set(StorageKeys.biometricEnabled, on ? '1' : '0');
    set({ biometricEnabled: on });
  },

  unlock: () => set({ biometricLocked: false }),
}));
