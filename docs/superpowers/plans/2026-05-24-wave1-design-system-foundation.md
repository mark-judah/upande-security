# Wave 1 — Design System Foundation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land all non-visible plumbing (theme tokens, fonts, storage, biometric, network, auth-store extensions, root-layout rewrite) so Waves 2–4 can drop in canonical primitives, chrome, and screen redesigns without coupling. The app still renders exactly as it does today after this wave.

**Architecture:** Add `src/core/*` modules mirroring upande-quality verbatim (theme, storage, biometric, network, version). Extend the existing `lib/stores/authStore.ts` in place to add biometric + hydration fields. Rewrite `app/_layout.tsx` to load DM Sans + Poppins, manage the native splash, hydrate auth + network, and gate routing on auth state. Remove unused NativeWind/Tailwind. The biometric-lock route is intentionally deferred (Wave 3 lands the screen); Wave 1 wires the state flag but routes to the existing app instead of a non-existent screen.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, Zustand 5, expo-font, @expo-google-fonts/dm-sans, @expo-google-fonts/poppins, expo-local-authentication, expo-network, expo-splash-screen, AsyncStorage.

**Reference spec:** `docs/superpowers/specs/2026-05-24-wave1-design-system-foundation.md`

---

## Pre-flight

Before starting, confirm the working tree state.

- [ ] **Step 0.1: Confirm baseline tree state**

Run:
```bash
git status --short
git log --oneline -1
```

Expected: HEAD at `3c47190 docs: add Wave 1 spec for design system foundation` (or a later commit). Several modified files from prior work are fine — they're unrelated to Wave 1.

- [ ] **Step 0.2: Confirm Node + npm work**

Run:
```bash
node -v && npm -v
```

Expected: any modern Node 18+. We will run `npx tsc --noEmit` between tasks.

- [ ] **Step 0.3: Capture a TypeScript baseline**

Run:
```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean (no output) — the project should currently type-check. If it doesn't, stop and fix or report before continuing — every subsequent task uses `tsc --noEmit` as its gate.

---

## Task 1: Add canonical theme tokens

**Files:**
- Create: `src/core/theme/index.ts`

Direct port of upande-quality's theme. Strict monochrome palette + status hues + DM Sans/Poppins font tokens + spacing/radius/shadow.

- [ ] **Step 1.1: Create directory**

Run:
```bash
mkdir -p src/core/theme
```

- [ ] **Step 1.2: Create `src/core/theme/index.ts`**

```typescript
// Canonical Upande design tokens. Mirror of upande-quality/src/core/theme/index.ts.
// Do not redesign — every Upande mobile app reads from this contract.

export const COLORS = {
  // Surfaces & text
  text: '#171717',
  textMuted: '#6B6B6B',
  textSecondary: '#525252',
  textOnPrimary: '#FFFFFF',
  border: '#E5E5E5',
  bg: '#FFFFFF',
  bgMuted: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F5',

  // Action / status
  primary: '#171717',
  info: '#171717',
  success: '#22C55E',
  warn: '#F59E0B',
  danger: '#EF4444',
  overlay: 'rgba(0, 0, 0, 0.4)',
} as const;

// Legacy alias kept so older files that import { colors } continue to compile
// during the migration. New code should use COLORS.
export const colors = {
  black: COLORS.text,
  white: COLORS.bg,
  gray900: '#0A0A0A',
  gray800: '#171717',
  gray700: '#262626',
  gray600: COLORS.textMuted,
  gray500: '#737373',
  gray400: '#A3A3A3',
  gray300: COLORS.border,
  gray200: '#E5E5E5',
  gray100: COLORS.bgMuted,
  gray50: '#FAFAFA',
  success: COLORS.success,
  error: COLORS.danger,
  warning: COLORS.warn,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 9999,
};

/** Production-aligned alias of `radius`. Use `borderRadius.full` for pills. */
export const borderRadius = {
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg,
  xl: 20,
  full: radius.pill,
};

export const fontFamily = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const typography = {
  display: { fontFamily: fontFamily.bold, fontSize: 28, color: COLORS.text },
  title: { fontFamily: fontFamily.bold, fontSize: 22, color: COLORS.text },
  heading: { fontFamily: fontFamily.semiBold, fontSize: 18, color: COLORS.text },
  body: { fontFamily: fontFamily.regular, fontSize: 15, color: COLORS.text },
  bodyBold: { fontFamily: fontFamily.semiBold, fontSize: 15, color: COLORS.text },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, color: COLORS.textMuted },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  h1: { fontFamily: fontFamily.bold, fontSize: fontSize.xxl, color: COLORS.text },
  h2: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: COLORS.text },
  h3: { fontFamily: fontFamily.semiBold, fontSize: fontSize.lg, color: COLORS.text },
  bodySmall: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textSecondary },
  mono: { fontFamily: 'monospace', fontSize: fontSize.md, color: COLORS.text },
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
};
```

- [ ] **Step 1.3: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean (no output). Theme has no callers yet, so this only verifies the file is well-typed.

- [ ] **Step 1.4: Commit**

```bash
git add src/core/theme/index.ts
git commit -m "$(cat <<'EOF'
feat(theme): add canonical design tokens at src/core/theme

Mirrors upande-quality's theme verbatim. Strict monochrome palette
with three status hues, DM Sans + Poppins font tokens, spacing/radius/
shadow primitives. No callers yet — Waves 2–4 migrate consumers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add storage wrapper

**Files:**
- Create: `src/core/storage/index.ts`

Typed AsyncStorage wrapper with `StorageKeys` enum object. Same key names as the existing app reads/writes today, so data persists across the upgrade.

- [ ] **Step 2.1: Create directory**

Run:
```bash
mkdir -p src/core/storage
```

- [ ] **Step 2.2: Create `src/core/storage/index.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageKeys = {
  cookie: 'cookie',
  instanceUrl: 'instanceurl',
  instanceUrlBackup: 'instanceurl_backup',
  emailBackup: 'email_backup',
  fullName: 'fullname',
  userStation: 'userStation',
  versionLastReportedOn: 'versionLastReportedOn',
  userRoles: 'userRoles',
  biometricEnabled: 'biometric_enabled',
} as const;

export const storage = {
  get: (key: string): Promise<string | null> => AsyncStorage.getItem(key),
  set: (key: string, value: string): Promise<void> => AsyncStorage.setItem(key, value),
  remove: (key: string): Promise<void> => AsyncStorage.removeItem(key),
  async clearExcept(keep: string[]): Promise<void> {
    const allKeys = Object.values(StorageKeys);
    await Promise.all(
      allKeys
        .filter((k) => !keep.includes(k))
        .map((k) => AsyncStorage.removeItem(k)),
    );
  },
};
```

- [ ] **Step 2.3: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 2.4: Commit**

```bash
git add src/core/storage/index.ts
git commit -m "$(cat <<'EOF'
feat(storage): add typed AsyncStorage wrapper at src/core/storage

Direct port from upande-quality. Key names match the existing app so
data persists across the migration. Adds biometric_enabled key for
Settings + Login.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add biometric service

**Files:**
- Create: `src/core/biometric/index.ts`

Safe wrapper around `expo-local-authentication`. Probes three ways for the native module before importing so OTA bundles loaded onto older binaries don't crash. The package itself is added in Task 6 — this file compiles against the lazy `require('expo-local-authentication')` so it's fine to commit before the dep is installed.

- [ ] **Step 3.1: Create directory**

Run:
```bash
mkdir -p src/core/biometric
```

- [ ] **Step 3.2: Create `src/core/biometric/index.ts`**

```typescript
/**
 * Safe wrapper around expo-local-authentication.
 *
 * The native module is compiled into the APK. If an OTA JS bundle loads the
 * shim on a binary that doesn't ship the native side, calling it crashes at
 * the native layer (JS can't catch it). We probe three ways before importing
 * the module and degrade silently when it's missing.
 */
import { NativeModules } from 'react-native';

let cached: any = null;
let attempted = false;

function nativeRegistered(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const core = require('expo-modules-core');
    if (core && typeof core.requireOptionalNativeModule === 'function') {
      const native = core.requireOptionalNativeModule('ExpoLocalAuthentication');
      if (native) return true;
    }
  } catch {}
  try {
    if (NativeModules && (NativeModules as any).ExpoLocalAuthentication) return true;
  } catch {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native');
    const reg = rn?.TurboModuleRegistry;
    if (reg && typeof reg.get === 'function') {
      if (reg.get('ExpoLocalAuthentication')) return true;
    }
  } catch {}
  return false;
}

function getModule(): any {
  if (attempted) return cached;
  attempted = true;
  if (!nativeRegistered()) return null;
  try {
    cached = require('expo-local-authentication');
    if (!cached || typeof cached.hasHardwareAsync !== 'function') cached = null;
  } catch {
    cached = null;
  }
  return cached;
}

export function isModuleAvailable(): boolean {
  return getModule() !== null;
}

export async function hasHardware(): Promise<boolean> {
  const m = getModule();
  if (!m) return false;
  try { return await m.hasHardwareAsync(); } catch { return false; }
}

export async function isEnrolled(): Promise<boolean> {
  const m = getModule();
  if (!m) return false;
  try { return await m.isEnrolledAsync(); } catch { return false; }
}

export async function isAvailable(): Promise<boolean> {
  if (!isModuleAvailable()) return false;
  const [hw, en] = await Promise.all([hasHardware(), isEnrolled()]);
  return hw && en;
}

export interface BiometricAuthOptions {
  promptMessage?: string;
  cancelLabel?: string;
  fallbackLabel?: string;
  disableDeviceFallback?: boolean;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

export async function authenticate(opts: BiometricAuthOptions = {}): Promise<BiometricAuthResult> {
  const m = getModule();
  if (!m) return { success: false, error: 'biometric_unavailable' };
  try {
    const res = await m.authenticateAsync(opts);
    return { success: !!res?.success, error: res?.error };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'auth_failed' };
  }
}
```

- [ ] **Step 3.3: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean. The `require()` calls are dynamic, so a missing `expo-local-authentication` package does not break compilation.

- [ ] **Step 3.4: Commit**

```bash
git add src/core/biometric/index.ts
git commit -m "$(cat <<'EOF'
feat(biometric): add safe wrapper around expo-local-authentication

Direct port from upande-quality. Three-way native-module probe
(expo-modules-core, NativeModules, TurboModuleRegistry) avoids crashes
when an OTA bundle loads on a binary that lacks the native module.
Failure modes return structured errors; never throw.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add network store

**Files:**
- Create: `src/core/network/store.ts`

Zustand store backed by `expo-network` with API-failure escalation. Drives the future `OfflineBanner` (Wave 2). The `expo-network` package is added in Task 6 — same lazy-import safety as Task 3.

- [ ] **Step 4.1: Create directory**

Run:
```bash
mkdir -p src/core/network
```

- [ ] **Step 4.2: Create `src/core/network/store.ts`**

```typescript
import { create } from 'zustand';
import { AppState, type AppStateStatus } from 'react-native';
import * as Network from 'expo-network';

/**
 * Network-status store. OS connectivity + API-failure escalation. After
 * `FAILURE_THRESHOLD` consecutive failures, flips to offline regardless of
 * what the OS reports — practical signal is whether OUR server is reachable.
 */

const FAILURE_THRESHOLD = 2;
const ONLINE_POLL_MS = 15_000;
const OFFLINE_POLL_MS = 6_000;

interface NetworkState {
  online: boolean;
  checking: boolean;
  consecutiveFailures: number;
  ready: boolean;

  init: () => void;
  forceCheck: () => Promise<void>;
  notifyApiSuccess: () => void;
  notifyApiFailure: () => void;
  setOnline: (online: boolean) => void;
}

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: { remove: () => void } | null = null;

async function checkConnectivity(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return !!(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  online: true,
  checking: false,
  consecutiveFailures: 0,
  ready: false,

  init: () => {
    if (get().ready) return;
    set({ ready: true });
    const scheduleNext = () => {
      if (pollTimer) clearTimeout(pollTimer);
      const delay = get().online ? ONLINE_POLL_MS : OFFLINE_POLL_MS;
      pollTimer = setTimeout(() => {
        get().forceCheck().finally(scheduleNext);
      }, delay);
    };
    appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') get().forceCheck();
    });
    get().forceCheck().finally(scheduleNext);
  },

  forceCheck: async () => {
    if (get().checking) return;
    set({ checking: true });
    try {
      const online = await checkConnectivity();
      if (online && get().consecutiveFailures === 0) {
        if (!get().online) set({ online: true });
      } else if (!online) {
        if (get().online) set({ online: false });
      }
    } finally {
      set({ checking: false });
    }
  },

  notifyApiSuccess: () => {
    if (get().consecutiveFailures > 0) set({ consecutiveFailures: 0 });
    if (!get().online) set({ online: true });
  },

  notifyApiFailure: () => {
    const next = get().consecutiveFailures + 1;
    set({ consecutiveFailures: next });
    if (next >= FAILURE_THRESHOLD && get().online) {
      set({ online: false });
      get().forceCheck();
    }
  },

  setOnline: (online) => set({ online }),
}));
```

- [ ] **Step 4.3: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: TypeScript will complain that `expo-network` is missing — that's installed in Task 6. Suppress the error for now by adding a temporary ambient declaration ONLY if `tsc` blocks the commit:

If you see `Cannot find module 'expo-network'`, run:
```bash
cat > src/core/network/expo-network.d.ts <<'EOF'
// Temporary stub — replaced when expo-network is installed in Task 6.
declare module 'expo-network' {
  export function getNetworkStateAsync(): Promise<{
    isConnected?: boolean;
    isInternetReachable?: boolean;
  }>;
}
EOF
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean. The stub file is deleted in Task 6 after the real package is installed.

- [ ] **Step 4.4: Commit**

```bash
git add src/core/network/
git commit -m "$(cat <<'EOF'
feat(network): add network store at src/core/network

Direct port from upande-quality. Backed by expo-network with API-
failure escalation: two consecutive failures flip the store to
offline regardless of what the OS reports. AppState listener
re-checks on foreground. Drives the future OfflineBanner.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add version module

**Files:**
- Create: `src/core/version/index.ts`

Read `APP_VERSION` from `Constants.expoConfig.version`. No server reporting in this wave.

- [ ] **Step 5.1: Create directory**

Run:
```bash
mkdir -p src/core/version
```

- [ ] **Step 5.2: Create `src/core/version/index.ts`**

```typescript
import Constants from 'expo-constants';

/** App version from app.json — surfaced in Settings and the login footer. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';
```

- [ ] **Step 5.3: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean. `expo-constants` is already a dep.

- [ ] **Step 5.4: Commit**

```bash
git add src/core/version/index.ts
git commit -m "$(cat <<'EOF'
feat(version): add APP_VERSION constant at src/core/version

Read once from expo-constants. Surfaced by the upcoming Login footer
and Settings screen (Waves 3). No server reporting in this wave.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Package adjustments — add fonts/biometric/network, remove NativeWind

**Files:**
- Modify: `package.json`
- Delete: `global.css`, `tailwind.config.js`, `nativewind-env.d.ts`
- Modify: `babel.config.js`, `metro.config.js`

Add DM Sans (fonts), `expo-local-authentication`, and `expo-network`. Remove `nativewind` + `tailwindcss` and their wiring. Verified up-front that **no `className=` usages** exist in `app/` or `components/` — removal is safe.

- [ ] **Step 6.1: Verify NativeWind is unused (re-check)**

Run:
```bash
grep -rn 'className=' --include="*.tsx" app components 2>/dev/null | head
grep -rn 'nativewind' --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | head
```

Expected: only `nativewind-env.d.ts` appears in the second grep; no `className=` usages anywhere. If anything else shows up, STOP and surface to the user before continuing — NativeWind isn't safely removable.

- [ ] **Step 6.2: Install new packages**

Run:
```bash
npx expo install @expo-google-fonts/dm-sans expo-local-authentication expo-network
```

Expected: three packages installed at expo-54-compatible versions.

- [ ] **Step 6.3: Remove NativeWind packages**

Run:
```bash
npm uninstall nativewind tailwindcss
```

Expected: both removed. `package-lock.json` shrinks.

- [ ] **Step 6.4: Delete NativeWind wiring files**

Run:
```bash
rm global.css tailwind.config.js nativewind-env.d.ts
```

- [ ] **Step 6.5: Rewrite `babel.config.js` without NativeWind**

Replace the file contents:

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
```

- [ ] **Step 6.6: Rewrite `metro.config.js` without `withNativeWind`**

Replace the file contents:

```javascript
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
```

- [ ] **Step 6.7: Delete the temporary expo-network ambient declaration if it exists**

Run:
```bash
rm -f src/core/network/expo-network.d.ts
```

Expected: removed if Task 4 created it; otherwise silent no-op.

- [ ] **Step 6.8: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 6.9: Smoke-test Metro can build**

Run:
```bash
npx expo export --platform ios --output-dir /tmp/metro-smoke 2>&1 | tail -20
```

Expected: bundle completes. If it errors with `cannot find module 'nativewind'`, hunt down the import: `grep -rn 'nativewind' --include="*.ts" --include="*.tsx" --include="*.js"`. The most common culprit is a stale `app/_layout.tsx:1 import '../global.css'` — that line is removed in Task 8, so this smoke test is allowed to fail on that specific import. If it does, skip the smoke test and continue; Task 8 fixes it.

After the smoke test (success or skip), clean up:
```bash
rm -rf /tmp/metro-smoke
```

- [ ] **Step 6.10: Commit**

```bash
git add package.json package-lock.json babel.config.js metro.config.js
git add -u global.css tailwind.config.js nativewind-env.d.ts 2>/dev/null || true
git rm -f global.css tailwind.config.js nativewind-env.d.ts 2>/dev/null || true
git commit -m "$(cat <<'EOF'
chore(deps): add DM Sans, biometric, expo-network; remove NativeWind

Adds @expo-google-fonts/dm-sans, expo-local-authentication,
expo-network to support the canonical design system foundation.
Removes nativewind + tailwindcss along with global.css, tailwind.config.js,
nativewind-env.d.ts, and their babel/metro wiring. Verified unused —
no className= usages in app/ or components/.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Extend authStore with biometric + hydration fields

**Files:**
- Modify: `lib/stores/authStore.ts` (full rewrite)
- Create: `src/core/auth/store.ts` (re-export)

Replace the existing store body with the canonical shape. Keeps `user`, `instanceUrl`, `isAuthenticated`, `hydrate`, `login`, `logout` for backwards compatibility. Adds `hydrated`, `hasSession`, `biometricEnabled`, `biometricLocked`, `setBiometricEnabled`, `unlock`, `forgetDevice`. The `isAuthenticated` field is **aliased** to `hasSession` so existing call sites don't break.

- [ ] **Step 7.1: Rewrite `lib/stores/authStore.ts`**

Replace the file contents:

```typescript
import { create } from 'zustand';
import { AppState, type AppStateStatus } from 'react-native';
import { login as apiLogin, logout as apiLogout } from '@/lib/api/auth';
import { storage, StorageKeys } from '@/src/core/storage';
import * as Biometric from '@/src/core/biometric';

type AuthState = {
  // Legacy shape — preserved for existing screens.
  user: { email: string; userId: string } | null;
  instanceUrl: string | null;
  isAuthenticated: boolean;

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

  hydrated: false,
  hasSession: false,
  biometricEnabled: false,
  biometricLocked: false,

  hydrate: async () => {
    const [email, url, cookie, bioFlag] = await Promise.all([
      storage.get(StorageKeys.emailBackup),
      storage.get(StorageKeys.instanceUrl),
      storage.get(StorageKeys.cookie),
      storage.get(StorageKeys.biometricEnabled),
    ]);
    const hasSession = !!(cookie && url);
    const biometricEnabled = bioFlag === '1';
    const biometricLocked =
      hasSession && biometricEnabled && Biometric.isModuleAvailable();

    set({
      user: email ? { email, userId: '' } : null,
      instanceUrl: url,
      isAuthenticated: hasSession,
      hasSession,
      hydrated: true,
      biometricEnabled,
      biometricLocked,
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
    set({
      user: { email, userId: result.userId ?? '' },
      instanceUrl: result.fullUrl,
      isAuthenticated: true,
      hasSession: true,
      // A fresh password login never lands on the biometric lock screen.
      biometricLocked: false,
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
    // Drop biometric flag plus any cached personal data.
    await Promise.all([
      storage.remove(StorageKeys.biometricEnabled),
      storage.remove(StorageKeys.emailBackup),
    ]);
    set({
      user: null,
      instanceUrl: null,
      isAuthenticated: false,
      hasSession: false,
      biometricEnabled: false,
      biometricLocked: false,
    });
  },

  setBiometricEnabled: async (on) => {
    await storage.set(StorageKeys.biometricEnabled, on ? '1' : '0');
    set({ biometricEnabled: on });
  },

  unlock: () => set({ biometricLocked: false }),
}));
```

- [ ] **Step 7.2: Create `src/core/auth/store.ts` as a re-export**

Run:
```bash
mkdir -p src/core/auth
```

Then create `src/core/auth/store.ts`:

```typescript
// Re-export of the canonical auth store. New code imports from this path;
// older imports of `@/lib/stores/authStore` keep working until migrated.
export { useAuthStore } from '@/lib/stores/authStore';
```

- [ ] **Step 7.3: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean. The existing call sites read `isAuthenticated`, `user`, `instanceUrl`, `hydrate`, `login`, `logout` — all preserved.

- [ ] **Step 7.4: Smoke-grep existing call sites**

Run:
```bash
grep -rn 'useAuthStore' --include="*.ts" --include="*.tsx" app components lib | head -20
```

Expected: each call references a field that still exists (`isAuthenticated`, `user.email`, `instanceUrl`, `logout`, `login`, `hydrate`). If any references a removed field, STOP and fix here before the next task.

- [ ] **Step 7.5: Commit**

```bash
git add lib/stores/authStore.ts src/core/auth/store.ts
git commit -m "$(cat <<'EOF'
feat(auth): extend authStore with biometric + hydration

Adds hydrated, hasSession, biometricEnabled, biometricLocked state +
unlock(), forgetDevice(), setBiometricEnabled() actions. Preserves all
existing fields (user, instanceUrl, isAuthenticated, hydrate, login,
logout) so current call sites continue to work. AppState listener
re-locks on foreground when biometric is enabled.

src/core/auth/store.ts re-exports the same hook from the canonical
path so new code (Wave 3 chrome screens) can use it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Root layout rewrite — fonts, splash, hydration, AppState

**Files:**
- Modify: `app/_layout.tsx` (full rewrite)
- Delete: `app/index.tsx`

Replace the root layout with the canonical shape: hold splash until DM Sans + Poppins load and auth hydrates, then route based on `hasSession` / `biometricLocked`. The biometric-lock route doesn't exist yet (Wave 3) — Wave 1 gates that branch off and falls through to the app.

- [ ] **Step 8.1: Rewrite `app/_layout.tsx`**

Replace the file contents:

```typescript
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import 'react-native-reanimated';
import { useAuthStore } from '@/lib/stores/authStore';
import { useNetworkStore } from '@/src/core/network/store';

// Hold the native splash until fonts + auth hydrated.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Wave 1: the biometric-lock screen does not yet exist (Wave 3 lands it).
// Until then, ignore the biometricLocked flag for routing — the lock state
// is still set correctly so Wave 3 only has to drop in the screen.
const BIOMETRIC_LOCK_ROUTE_AVAILABLE = false;

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hasSession = useAuthStore((s) => s.hasSession);
  const biometricLocked = useAuthStore((s) => s.biometricLocked);
  const initNetwork = useNetworkStore((s) => s.init);

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    hydrate();
    initNetwork();
  }, [hydrate, initNetwork]);

  useEffect(() => {
    if (fontsLoaded && hydrated) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, hydrated]);

  // Safety net: never hold the splash forever. If fonts hang for 5 s, give up.
  useEffect(() => {
    const timeout = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const first = segments[0];
    const inAuthGroup = first === '(app)';

    if (!hasSession && first !== 'login') {
      router.replace('/login');
      return;
    }
    if (
      BIOMETRIC_LOCK_ROUTE_AVAILABLE &&
      hasSession &&
      biometricLocked &&
      first !== 'biometric-lock'
    ) {
      // Wave 3 will land /biometric-lock and flip the flag above to true.
      router.replace('/biometric-lock' as any);
      return;
    }
    if (hasSession && !biometricLocked && !inAuthGroup && first !== 'biometric-lock') {
      router.replace('/(app)/(tabs)/gate');
      return;
    }
  }, [hydrated, hasSession, biometricLocked, segments, router]);

  if (!fontsLoaded || !hydrated) {
    // Splash is still showing.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="(app)" />
          </Stack>
          <Toast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 8.2: Delete `app/index.tsx`**

The root layout's segment-based routing replaces the manual `<Redirect>` in `app/index.tsx`.

Run:
```bash
git rm app/index.tsx
```

Expected: removed and staged.

- [ ] **Step 8.3: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 8.4: Confirm Metro builds (real bundle this time)**

Run:
```bash
npx expo export --platform ios --output-dir /tmp/metro-final 2>&1 | tail -30
```

Expected: bundle completes without `global.css` errors. If it still fails, the most likely cause is a leftover `import '../global.css'` somewhere — find with `grep -rn "global.css" --include="*.tsx" --include="*.ts"`.

Clean up:
```bash
rm -rf /tmp/metro-final
```

- [ ] **Step 8.5: Commit**

```bash
git add app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(layout): rewrite root — fonts, splash, hydration, auth routing

Hold the native splash until DM Sans + Poppins load AND auth hydrates,
then route on hasSession / biometricLocked. AppState re-lock listener
moves to authStore in this wave; biometric-lock route itself is
gated off (Wave 3 lands the screen). app/index.tsx is removed —
the root layout owns auth routing now via expo-router segments.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Post-flight

After Task 8, run a full smoke test on a development build.

- [ ] **Step 9.1: Type-check everything**

Run:
```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 9.2: Lint everything**

Run:
```bash
npx eslint . 2>&1 | tail -20
```

Expected: clean (or only pre-existing warnings unrelated to this wave).

- [ ] **Step 9.3: Start the dev server**

Run:
```bash
npx expo start --dev-client
```

Expected: Metro starts. Open the dev build on a real device (or emulator with the dev client installed).

- [ ] **Step 9.4: Manual smoke checklist**

Verify each of the following on the running app:

- App boots without flashing the white screen — splash holds until ready.
- Login screen still renders (unchanged in this wave) and credentials still work.
- After login, lands on `/(app)/(tabs)/gate` exactly as before.
- All 17 existing routes render visually identical to the prior build (Gate, Visits, Approved, Summary, Incidents, Patrol).
- Background the app for 10 s, foreground it — no crash. (Biometric lock state is set but routing is gated off, so the user still sees their last screen.)
- Kill and re-open the app — auth still hydrated; user lands on `/(app)/(tabs)/gate` without re-logging in.

If any item fails, STOP and surface it before claiming Wave 1 done.

- [ ] **Step 9.5: Confirm log shows hidden state**

In the running app's logs, you should see:

```
[authStore] hydrated, hasSession=true, biometricEnabled=false, biometricLocked=false
```

(If you added a log statement during testing — optional, not committed.)

---

## Wave 1 done

Eight commits land Wave 1. Total: ~250 LoC of new code, ~80 LoC of removed code, one rewritten root layout, one in-place authStore extension. The app is visually unchanged but ready for:

- **Wave 2** — canonical primitives at `src/core/ui/*` (Screen, Button, Card, SideMenu, Toast, Input, Dropdown, FAB, Spinner, ProgressBar, Segmented, OfflineBanner, Alert, EmptyState).
- **Wave 3** — canonical chrome (login redesign, biometric-lock screen, settings with Fetch Updates, drawer wiring; flip `BIOMETRIC_LOCK_ROUTE_AVAILABLE` to `true`).
- **Wave 4** — screen sweep (every existing screen migrated to primitives + tokens + Ionicons).

Each wave gets its own brainstorm cycle.
