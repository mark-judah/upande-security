# Wave 3 — Canonical chrome screens: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land three new screens (login rewrite, biometric-lock, settings) plus four small layout edits to wire Toast, drawer, hidden settings tab, and turn on biometric-lock routing. After this wave the canonical look + biometric flow are end-to-end usable.

**Architecture:** Six atomic commits. Mount providers in the root layout first so subsequent screens can call `useToast` and the SideMenu can read the drawer items list. Login rewrites to the canonical inline-URL + biometric-FAB pattern. Biometric-lock is a new root-level screen. Then flip `BIOMETRIC_LOCK_ROUTE_AVAILABLE` to `true` so the cold-start lock path activates. Register `settings` as a hidden tab so the route exists but doesn't show in the bottom bar. Finally drop in the Settings screen with Account / Security / App / Session cards.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router 6, expo-local-authentication, expo-updates, expo-constants, Zustand 5, Ionicons. All canonical primitives come from `src/core/ui/*` (added in Wave 2).

**Reference spec:** `docs/superpowers/specs/2026-05-24-wave3-canonical-chrome.md`

---

## Pre-flight

- [ ] **Step 0.1: Confirm baseline**

```bash
cd /home/jk/Projects/upande-security
git log --oneline -1
npx tsc --noEmit 2>&1 | tail -5
```

Expected: HEAD at `293883b` (Wave 3 spec) or later. `tsc --noEmit` clean.

- [ ] **Step 0.2: Confirm Wave 1 + Wave 2 modules + primitives exist**

```bash
ls src/core/ui/Screen.tsx src/core/ui/Card.tsx src/core/ui/Button.tsx \
   src/core/ui/Toast.tsx src/core/ui/SideMenu.tsx \
   src/core/ui/drawer-items-context.tsx \
   src/core/auth/store.ts src/core/biometric/index.ts \
   src/core/storage/index.ts src/core/version/index.ts
```

Expected: all 10 files exist. If any are missing, STOP — that prerequisite wave didn't ship.

- [ ] **Step 0.3: Confirm BIOMETRIC_LOCK_ROUTE_AVAILABLE is currently `false`**

```bash
grep BIOMETRIC_LOCK_ROUTE_AVAILABLE app/_layout.tsx
```

Expected output includes a line `const BIOMETRIC_LOCK_ROUTE_AVAILABLE = false;`. Task 4 will flip it.

---

## Task 1: Mount ToastProvider + DrawerItemsProvider in root layout

**Files:**
- Modify: `app/_layout.tsx`

This wraps the existing tree with two new providers and defines `DRAWER_ITEMS`. No routing flag change yet — biometric-lock stays gated off until Task 4.

- [ ] **Step 1.1: Replace `app/_layout.tsx` contents**

Write the file with EXACTLY this content (full file replacement):

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
import { ToastProvider } from '@/src/core/ui/Toast';
import { DrawerItemsProvider, type DrawerItem } from '@/src/core/ui/drawer-items-context';

// Hold the native splash until fonts + auth hydrated.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Wave 1: the biometric-lock screen does not yet exist (Wave 3 lands it).
// Until then, ignore the biometricLocked flag for routing — the lock state
// is still set correctly so Wave 3 only has to drop in the screen.
const BIOMETRIC_LOCK_ROUTE_AVAILABLE = false;

const queryClient = new QueryClient();

const DRAWER_ITEMS: DrawerItem[] = [
  { label: 'Gate', route: '(app)/(tabs)/gate', icon: 'log-in-outline' },
  { label: 'Incidents', route: '(app)/(tabs)/incidents', icon: 'warning-outline' },
  { label: 'Patrol', route: '(app)/(tabs)/patrol', icon: 'walk-outline' },
];

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
      (first as string) !== 'biometric-lock'
    ) {
      // Wave 3 will land /biometric-lock and flip the flag above to true.
      router.replace('/biometric-lock' as any);
      return;
    }
    if (hasSession && !biometricLocked && !inAuthGroup && (first as string) !== 'biometric-lock') {
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
        <ToastProvider>
          <DrawerItemsProvider items={DRAWER_ITEMS}>
            <QueryClientProvider client={queryClient}>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="login" />
                <Stack.Screen name="(app)" />
              </Stack>
              <Toast />
            </QueryClientProvider>
          </DrawerItemsProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 1.2: Type-check**

```bash
cd /home/jk/Projects/upande-security && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 1.3: Commit**

```bash
cd /home/jk/Projects/upande-security
git add app/_layout.tsx
git diff --staged --stat
git commit -m "$(cat <<'EOF'
feat(layout): mount ToastProvider + DrawerItemsProvider

Wraps the existing tree so child screens can call useToast (Wave 3
chrome screens use it) and SideMenu can read the drawer items list.
DRAWER_ITEMS lists upande-security's three primary nav routes (Gate,
Incidents, Patrol). Settings stays in the SideMenu footer; sub-tabs
inside Gate (Visits/Approved/Summary) are not drawer-level routes.

BIOMETRIC_LOCK_ROUTE_AVAILABLE stays false — Task 4 flips it after
the biometric-lock screen is in place. Legacy <Toast /> from
react-native-toast-message stays alongside; useFeedback still works
for legacy screens until Wave 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rewrite login.tsx to canonical pattern

**Files:**
- Modify (full rewrite): `app/login.tsx`

Replaces the Modal-based URL config with the canonical inline URL field. Adds the biometric quick-unlock FAB shown only when a cookie + biometric flag + native module are all present. Adds a small `v{APP_VERSION}` footer.

Key adaptations from upande-quality's login:
- No `useTenant()` (upande-security is single-tenant).
- No `authRepository` — reads via `storage` wrapper directly.
- `authStore.login(url, email, password)` signature (note arg order — `url` first).
- `lib/api/auth.ts` already calls `getWorkingUrl()` internally, so the screen does NOT need to import or call it.
- Redirect to `/(app)/(tabs)/gate` (not `/traceability`).
- Biometric prompt: `"Unlock Upande Security"`.
- Title: `"Upande Security"`.

- [ ] **Step 2.1: Replace `app/login.tsx`**

Write with EXACTLY this content:

```typescript
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Card } from '@/src/core/ui/Card';
import { Button } from '@/src/core/ui/Button';
import { useAuthStore } from '@/src/core/auth/store';
import { storage, StorageKeys } from '@/src/core/storage';
import * as Biometric from '@/src/core/biometric';
import { COLORS, borderRadius, shadow, spacing } from '@/src/core/theme';
import { APP_VERSION } from '@/src/core/version';

export default function Login() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const login = useAuthStore((s) => s.login);
  const hydrate = useAuthStore((s) => s.hydrate);
  const unlock = useAuthStore((s) => s.unlock);

  // Biometric login is available when:
  //   - a session cookie is still stored on this device, AND
  //   - the biometric_enabled flag was turned on in Settings, AND
  //   - the native biometric module is present in the running binary
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [emailBackup, instanceUrlStored, cookie, bioFlag] = await Promise.all([
        storage.get(StorageKeys.emailBackup),
        storage.get(StorageKeys.instanceUrl),
        storage.get(StorageKeys.cookie),
        storage.get(StorageKeys.biometricEnabled),
      ]);
      if (emailBackup) setEmail(emailBackup);
      if (instanceUrlStored) setUrl(instanceUrlStored.replace(/^https?:\/\//i, ''));
      setBioAvailable(!!cookie && bioFlag === '1' && Biometric.isModuleAvailable());
    })();
  }, []);

  const onBiometric = async () => {
    setBioBusy(true);
    setErr(null);
    try {
      const res = await Biometric.authenticate({
        promptMessage: 'Unlock Upande Security',
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
      });
      if (res.success) {
        // Stored session is the authentication; biometric just gates the unlock.
        await hydrate();
        unlock();
        router.replace('/(app)/(tabs)/gate');
      } else if (res.error && !['user_cancel', 'system_cancel'].includes(res.error)) {
        setErr("Couldn't verify biometric. Use your password.");
      }
    } finally {
      setBioBusy(false);
    }
  };

  const submit = async () => {
    if (!url.trim()) {
      setErr('Instance URL is required.');
      return;
    }
    if (!email.trim() || !password) {
      setErr('Email and password are required.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      // authStore.login calls lib/api/auth.login which internally resolves
      // shortform URLs like 'kaitet' via getWorkingUrl.
      await login(url.trim(), email.trim(), password);
      router.replace('/(app)/(tabs)/gate');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen title="Upande Security" hideMenu>
      <Card>
        <Text style={s.intro}>Sign in with your Frappe user account.</Text>
      </Card>

      <Card>
        <Field
          label="Instance URL"
          value={url}
          onChange={setUrl}
          placeholder="kaitet.upande.com"
          keyboardType="url"
        />
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          keyboardType="email-address"
        />
        <View style={s.pwWrap}>
          <Text style={s.label}>Password</Text>
          <View style={s.pwRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={s.pwInput}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Text style={s.pwToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
        </View>
        {err ? <Text style={s.err}>{err}</Text> : null}
      </Card>

      <Button label="Sign in" onPress={submit} loading={submitting} />

      {bioAvailable ? (
        <TouchableOpacity
          onPress={onBiometric}
          disabled={bioBusy}
          activeOpacity={0.8}
          style={s.bioFab}
        >
          {bioBusy ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Ionicons name="finger-print" size={28} color={COLORS.text} />
          )}
        </TouchableOpacity>
      ) : null}

      <View style={s.footer}>
        <Text style={s.version}>v{APP_VERSION}</Text>
      </View>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'url';
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType ?? 'default'}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        style={s.input}
      />
    </View>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 14, color: COLORS.text },
  label: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  pwWrap: { marginBottom: 10 },
  pwRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 10,
  },
  pwInput: { flex: 1, fontSize: 15, color: COLORS.text, paddingVertical: 10 },
  pwToggle: { color: COLORS.text, fontSize: 13, fontWeight: '600', padding: 6 },
  err: { color: COLORS.danger, fontSize: 13, marginTop: 4 },
  footer: { alignItems: 'center', paddingTop: 24 },
  version: { fontSize: 11, color: COLORS.textMuted },
  bioFab: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
});
```

- [ ] **Step 2.2: Type-check**

```bash
cd /home/jk/Projects/upande-security && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 2.3: Commit**

```bash
cd /home/jk/Projects/upande-security
git add app/login.tsx
git commit -m "$(cat <<'EOF'
feat(login): rewrite to canonical inline URL + biometric FAB

Replaces the Modal-based 'Configure instance URL' flow with the
canonical inline URL field that ships across every Upande app. Adds
a biometric quick-unlock FAB shown only when a session cookie +
biometric flag + native module are all present. Uses the new
src/core/ui/{Screen,Card,Button} primitives.

Adaptations from upande-quality: no useTenant (single-tenant);
storage wrapper instead of authRepository; redirect to /(app)/(tabs)/gate;
prompt label 'Unlock Upande Security'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add biometric-lock screen

**Files:**
- Create: `app/biometric-lock.tsx`

New screen at the root level (sibling of `app/login.tsx`). Auto-prompts on mount. "Use password instead" → `forgetDevice()` → `/login`.

- [ ] **Step 3.1: Create `app/biometric-lock.tsx`**

Write with EXACTLY this content:

```typescript
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, fontFamily, fontSize, shadow, spacing } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/auth/store';
import * as Biometric from '@/src/core/biometric';

export default function BiometricLockScreen() {
  const unlock = useAuthStore((s) => s.unlock);
  const forgetDevice = useAuthStore((s) => s.forgetDevice);
  const user = useAuthStore((s) => s.user);
  const email = user?.email ?? null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prompted = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await Biometric.authenticate({
      promptMessage: 'Unlock Upande Security',
      fallbackLabel: 'Use password',
      cancelLabel: 'Cancel',
    });
    setBusy(false);
    if (res.success) {
      unlock();
      return;
    }
    if (res.error === 'biometric_unavailable') {
      setError('Biometric unavailable on this build. Sign in with your password.');
      return;
    }
    if (res.error && !['user_cancel', 'system_cancel'].includes(res.error)) {
      setError("Couldn't verify. Try again or use your password.");
    }
  }, [busy, unlock]);

  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    tryUnlock();
  }, [tryUnlock]);

  const onForget = async () => {
    await forgetDevice();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.content}>
        <View style={s.logoCircle}>
          <Image
            source={require('@/assets/images/upande_logo.png')}
            style={{ width: 56, height: 56, resizeMode: 'contain' }}
          />
        </View>
        <Text style={s.title}>{email ?? 'Welcome back'}</Text>
        <Text style={s.sub}>Sign in with biometrics to continue.</Text>

        <TouchableOpacity onPress={tryUnlock} disabled={busy} activeOpacity={0.8} style={s.fab}>
          {busy ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Ionicons name="finger-print" size={36} color={COLORS.text} />
          )}
        </TouchableOpacity>

        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={onForget} hitSlop={8} style={s.linkBtn}>
          <Text style={s.linkText}>Use password instead</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  logoCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: COLORS.text, textAlign: 'center' },
  sub: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textSecondary, textAlign: 'center' },
  fab: {
    marginTop: spacing.lg,
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    padding: spacing.md, borderRadius: 10, maxWidth: 320,
  },
  errorText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.danger },
  linkBtn: { marginTop: spacing.md, padding: spacing.sm },
  linkText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.primary },
});
```

- [ ] **Step 3.2: Type-check**

```bash
cd /home/jk/Projects/upande-security && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 3.3: Commit**

```bash
cd /home/jk/Projects/upande-security
git add app/biometric-lock.tsx
git commit -m "$(cat <<'EOF'
feat(biometric-lock): add lock screen at app root

Auto-prompts on mount via the Wave 1 biometric service. On success
calls authStore.unlock() — the root layout's routing effect picks it
up and sends the user to gate. 'Use password instead' calls
forgetDevice() (hard logout) → /login.

Adapted from upande-quality. Reads user.email from authStore (no
fullName field). Prompt message 'Unlock Upande Security'.

This screen does NOT activate yet — the root layout's
BIOMETRIC_LOCK_ROUTE_AVAILABLE flag is still false. Task 4 flips it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Flip BIOMETRIC_LOCK_ROUTE_AVAILABLE to true

**Files:**
- Modify: `app/_layout.tsx` (one-line change)

With Task 3's screen now in place, turn on the cold-start lock routing. The compile-time route table now contains `biometric-lock`, so the previously-cast `'/biometric-lock' as any` will route there.

- [ ] **Step 4.1: Flip the flag**

In `app/_layout.tsx`, find the line:

```typescript
const BIOMETRIC_LOCK_ROUTE_AVAILABLE = false;
```

Change it to:

```typescript
const BIOMETRIC_LOCK_ROUTE_AVAILABLE = true;
```

Also update the comment immediately above. Replace:

```typescript
// Wave 1: the biometric-lock screen does not yet exist (Wave 3 lands it).
// Until then, ignore the biometricLocked flag for routing — the lock state
// is still set correctly so Wave 3 only has to drop in the screen.
const BIOMETRIC_LOCK_ROUTE_AVAILABLE = false;
```

with:

```typescript
// The biometric-lock screen lives at app/biometric-lock.tsx and is routable
// when this flag is true. The auth store's biometricLocked flag still drives
// when the route activates — see the routing effect below.
const BIOMETRIC_LOCK_ROUTE_AVAILABLE = true;
```

- [ ] **Step 4.2: Type-check**

```bash
cd /home/jk/Projects/upande-security && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean. (The `'/biometric-lock' as any` cast still works; typed routes resolve at build, not commit.)

- [ ] **Step 4.3: Commit**

```bash
cd /home/jk/Projects/upande-security
git add app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(layout): flip BIOMETRIC_LOCK_ROUTE_AVAILABLE to true

The biometric-lock screen landed in the previous commit. With the
flag on, the root layout's routing effect now sends users to
/biometric-lock on cold start when hasSession + biometricEnabled +
native module are all present, and on every foreground transition
via the AppState listener in authStore.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Register hidden settings route in tabs layout

**Files:**
- Modify: `app/(app)/(tabs)/_layout.tsx`

Add one hidden tab entry so the settings route exists without showing in the bottom bar. SideMenu footer's `onSettings` will `router.push('/settings')` — for that to land somewhere routable inside the (tabs) group, the route must be registered.

- [ ] **Step 5.1: Add the settings tab entry**

In `app/(app)/(tabs)/_layout.tsx`, find the existing block of `<Tabs.Screen>` entries (Gate, Patrol, Incidents). After the `Incidents` entry, BEFORE the closing `</Tabs>`, insert:

```typescript
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', href: null }}
      />
```

The full file should now look like:

```typescript
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8E8E8',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="gate"
        options={{
          title: 'Check In',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="login" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="patrol"
        options={{
          title: 'Patrol',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="directions-walk" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: 'Incidents',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="report" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', href: null }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 5.2: Type-check**

```bash
cd /home/jk/Projects/upande-security && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean. (The actual `settings.tsx` file doesn't exist yet — Task 6 adds it. Expo Router will compile against the file system at build time but TypeScript doesn't validate the route file's existence here.)

- [ ] **Step 5.3: Commit**

```bash
cd /home/jk/Projects/upande-security
git add app/'(app)'/'(tabs)'/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(tabs): register hidden settings route

Settings is accessible only via the SideMenu footer, not the bottom
tab bar. href: null hides the entry from the bar while keeping the
route resolvable. The actual screen file lands in Task 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add Settings screen

**Files:**
- Create: `app/(app)/(tabs)/settings.tsx`

Four cards: Account, Security, App, Session. Uses `useToast()` from the provider mounted in Task 1, `Biometric` service from Wave 1, `Updates` from `expo-updates`.

Adaptations vs upande-quality's settings:
- No `fullName` — uses `user?.email` for both name and email display.
- No tenant — `instanceUrl` from `useAuthStore`.
- All other logic verbatim.

- [ ] **Step 6.1: Create `app/(app)/(tabs)/settings.tsx`**

Write with EXACTLY this content:

```typescript
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { Screen } from '@/src/core/ui/Screen';
import { Card } from '@/src/core/ui/Card';
import { Button } from '@/src/core/ui/Button';
import { useToast } from '@/src/core/ui/Toast';
import { useAuthStore } from '@/src/core/auth/store';
import * as Biometric from '@/src/core/biometric';
import { COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const email = user?.email ?? null;
  const instanceUrl = useAuthStore((s) => s.instanceUrl);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const logout = useAuthStore((s) => s.logout);
  const forgetDevice = useAuthStore((s) => s.forgetDevice);
  const { showSuccess, showError } = useToast();

  const [moduleReady, setModuleReady] = useState(false);
  const [hardwareReady, setHardwareReady] = useState(false);
  const [updatesChecking, setUpdatesChecking] = useState(false);

  useEffect(() => {
    setModuleReady(Biometric.isModuleAvailable());
    Biometric.isAvailable().then(setHardwareReady);
  }, []);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const runtimeVersion = (Updates.runtimeVersion as string | undefined) || appVersion;

  const onToggleBiometric = async () => {
    if (!biometricEnabled) {
      if (!moduleReady) {
        Alert.alert('Update needed', 'Install the latest build to enable biometric unlock.');
        return;
      }
      if (!hardwareReady) {
        Alert.alert(
          'Biometric unavailable',
          'Enroll a fingerprint or face in your device settings, then try again.',
        );
        return;
      }
      const res = await Biometric.authenticate({
        promptMessage: 'Confirm biometric unlock',
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
      });
      if (!res.success) return;
    }
    try {
      await setBiometricEnabled(!biometricEnabled);
      showSuccess(biometricEnabled ? 'Biometric unlock disabled.' : 'Biometric unlock enabled.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not update setting.');
    }
  };

  const onCheckUpdates = async () => {
    if (__DEV__) {
      showError('OTA updates are unavailable in development.');
      return;
    }
    setUpdatesChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        showSuccess("You're on the latest version.");
        return;
      }
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) {
        Alert.alert('Update ready', 'Reload now to apply it?', [
          { text: 'Later', style: 'cancel' },
          { text: 'Reload', onPress: () => Updates.reloadAsync() },
        ]);
      } else {
        showSuccess("You're on the latest version.");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not check for updates.');
    } finally {
      setUpdatesChecking(false);
    }
  };

  const onSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in with biometrics or your password.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const onForgetDevice = () => {
    Alert.alert(
      'Forget this device?',
      'Clears your session and disables biometric unlock.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            await forgetDevice();
            router.replace('/login');
          },
        },
      ],
    );
  };

  return (
    <Screen title="Settings">
      <Card>
        <View style={s.avatarRow}>
          <View style={s.avatar}>
            <Text style={s.avatarInitials}>
              {(email || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.userName}>{email || 'Signed in'}</Text>
            {instanceUrl ? <Text style={s.userMeta}>{instanceUrl}</Text> : null}
          </View>
        </View>
      </Card>

      <Card title="Security">
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Biometric unlock</Text>
            <Text style={s.rowHint}>
              {!moduleReady
                ? 'Install latest build to enable'
                : !hardwareReady
                  ? 'Enroll fingerprint/face in device settings'
                  : 'Skip the password with fingerprint or face'}
            </Text>
          </View>
          <Toggle value={biometricEnabled} onChange={onToggleBiometric} />
        </View>
      </Card>

      <Card title="App">
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Version</Text>
            <Text style={s.rowHint}>
              {appVersion}
              {runtimeVersion && runtimeVersion !== appVersion ? `  ·  runtime ${runtimeVersion}` : ''}
            </Text>
          </View>
        </View>
        <View style={{ height: spacing.md }} />
        <Button
          label={updatesChecking ? 'Checking…' : 'Check for updates'}
          variant="outline"
          onPress={onCheckUpdates}
          loading={updatesChecking}
          iconLeft="cloud-download-outline"
        />
      </Card>

      <Card title="Session">
        <Button label="Sign out" variant="outline" onPress={onSignOut} />
        <View style={{ height: spacing.sm }} />
        <Button
          label="Forget this device"
          variant="outline"
          color={COLORS.danger}
          onPress={onForgetDevice}
          iconLeft="trash-outline"
        />
      </Card>
    </Screen>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <TouchableOpacity
      onPress={onChange}
      activeOpacity={0.8}
      style={[s.toggle, value && s.toggleOn]}
    >
      <View style={[s.toggleDot, value && s.toggleDotOn]} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: COLORS.textOnPrimary },
  userName: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text },
  userMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text },
  rowHint: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
  toggle: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: '#E5E5E5', padding: 3, justifyContent: 'center',
  },
  toggleOn: { backgroundColor: COLORS.text },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.surface },
  toggleDotOn: { transform: [{ translateX: 20 }] },
});
```

- [ ] **Step 6.2: Type-check**

```bash
cd /home/jk/Projects/upande-security && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 6.3: Confirm Metro bundles**

```bash
cd /home/jk/Projects/upande-security && npx expo export --platform ios --output-dir /tmp/wave3-final 2>&1 | tail -10
```

Expected: bundle completes. Clean up:

```bash
rm -rf /tmp/wave3-final
```

- [ ] **Step 6.4: Commit**

```bash
cd /home/jk/Projects/upande-security
git add app/'(app)'/'(tabs)'/settings.tsx
git commit -m "$(cat <<'EOF'
feat(settings): add Account/Security/App/Session screen

Four Card sections matching the canonical upande-quality Settings.
Adapts to upande-security's authStore (no fullName field — display
email everywhere). Biometric toggle uses the Wave 1 biometric
service with state-aware hint text. 'Check for updates' button
hits expo-updates (with __DEV__ guard). Sign out is soft (keeps
cookie + biometric flag); Forget device is hard (wipes both).
Uses the new useToast for success/error feedback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Post-flight

- [ ] **Step 7.1: Type-check everything**

```bash
cd /home/jk/Projects/upande-security && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 7.2: Lint**

```bash
cd /home/jk/Projects/upande-security && npx eslint . 2>&1 | tail -20
```

Expected: clean or only pre-existing warnings unrelated to Wave 3.

- [ ] **Step 7.3: Confirm Metro bundle**

```bash
cd /home/jk/Projects/upande-security && npx expo export --platform ios --output-dir /tmp/wave3-postflight 2>&1 | tail -10
rm -rf /tmp/wave3-postflight
```

Expected: bundle completes.

- [ ] **Step 7.4: Confirm scope discipline — only the planned files touched**

```bash
cd /home/jk/Projects/upande-security && git log --name-only 293883b..HEAD | grep -E "^(app|src|components|lib|frappe)/" | sort -u
```

Expected, exactly:
```
app/(app)/(tabs)/_layout.tsx
app/(app)/(tabs)/settings.tsx
app/_layout.tsx
app/biometric-lock.tsx
app/login.tsx
```

If anything else appears (especially under `components/`, `lib/`, `frappe/`), surface it before claiming Wave 3 done.

- [ ] **Step 7.5: Manual on-device smoke test**

Run the dev build (`npx expo start --dev-client` — dev client is required because Wave 1 added `expo-local-authentication` and Wave 2 added `expo-network` as native deps).

Walk through:

1. Cold start signed-in, biometric OFF: lands on `/(app)/(tabs)/gate`. Header shows "Check In" or similar — bottom tabs still show Gate / Patrol / Incidents (no Settings tab).
2. Tap the hamburger in any Screen header: drawer slides in. Avatar shows initial from email, email + instanceUrl in the header. Nav rows show Gate / Incidents / Patrol with Ionicons. Footer shows Settings + Sign Out + "Upande Security v{APP_VERSION}".
3. Tap Settings in the drawer: lands on `/settings` (the hidden tab route). Screen shows Account / Security / App / Session cards.
4. Toggle biometric ON: biometric prompt confirms; toast: "Biometric unlock enabled." Toggle reflects new state.
5. Background the app for ~10 seconds, then foreground: biometric-lock screen appears with the prompt. Cancel → error toast "Couldn't verify. Try again or use your password." Tap fingerprint icon → prompt again → success → land back on gate.
6. From lock screen, tap "Use password instead" → land on `/login` with email + URL pre-filled, biometric FAB still visible (cookie still on disk). Tap FAB → biometric prompts → gate.
7. From Settings, tap "Sign out" → confirm → land on `/login` (cookie + biometric flag preserved, FAB still shown).
8. From Settings, tap "Forget this device" → confirm → land on `/login` (cookie + flag wiped, FAB GONE).
9. "Check for updates" in dev: toast "OTA updates are unavailable in development."

If any item fails, surface it before claiming Wave 3 done.

---

## Wave 3 done

Six atomic commits land the canonical chrome. After Wave 3:

- Login uses canonical pattern (inline URL + biometric FAB + version footer).
- Biometric lock screen is live; foregrounding re-locks automatically.
- Settings is accessible from the drawer with all four cards.
- The new ToastProvider feeds the new screens; legacy `useFeedback` keeps working for unmigrated screens.

Wave 4 will migrate the existing feature screens (gate / incidents / patrol) to the new primitives + tokens + Ionicons, retire `useFeedback`, and remove the bottom-tab MaterialIcons.
