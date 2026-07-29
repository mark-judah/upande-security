# Wave 3 — Canonical chrome screens

**Status:** Draft
**Date:** 2026-05-24
**Owner:** upande-security
**Reference:** Wave 3 of the 4-wave migration aligning upande-security with upande-quality + mobile-app-blueprint.html.
**Predecessors:**
- Wave 1: `docs/superpowers/specs/2026-05-24-wave1-design-system-foundation.md` — theme/storage/biometric/network/version/authStore/root-layout.
- Wave 2: `docs/superpowers/specs/2026-05-24-wave2-canonical-primitives.md` — 17 primitives at `src/core/{ui,audio}/`.

## Goal

Land the three canonical chrome screens (login redesign, biometric-lock, settings) plus the small layout edits that wire the drawer and turn the biometric-lock route on. After this wave, the canonical look + biometric flow are end-to-end usable. Existing feature screens (gate / incidents / patrol) still use their old primitives — Wave 4 sweeps those.

## Scope

**In scope**

1. Full rewrite of `app/login.tsx` to the canonical pattern (inline URL field, biometric quick-unlock FAB, version footer) using `src/core/ui/{Screen,Card,Button}`.
2. New `app/biometric-lock.tsx` at the root level (not under `(tabs)`).
3. New `app/(app)/(tabs)/settings.tsx` with Account / Security / App / Session cards (Biometric toggle + Fetch Updates).
4. `app/(app)/(tabs)/_layout.tsx` — register `settings` as a hidden tab (`href: null`).
5. `app/_layout.tsx` — flip `BIOMETRIC_LOCK_ROUTE_AVAILABLE` to `true`, mount `<ToastProvider>`, mount `<DrawerItemsProvider>` with upande-security's three primary routes.
6. Each commit `tsc --noEmit` clean. Final Metro `expo export` smoke + on-device biometric flow walk-through.

**Out of scope (Wave 4)**

- Migrating any existing feature screen (gate/index, gate/pending, gate/approved, gate/summary, incidents/*, patrol/*, scan) to the new primitives + tokens + Ionicons.
- Adding a `fullName` field to authStore. Email shown everywhere for v1.
- Swapping `react-native-toast-message` for the new `useToast` in legacy screens. Both coexist; new chrome uses `useToast`.
- Bottom-tab icon swap MaterialIcons → Ionicons (deferred to Wave 4's icon sweep).

## File-by-file

### `app/login.tsx` — full rewrite

Adapted from upande-quality. Key adaptations:

- Replace the existing Modal-based "Configure instance URL" flow with the canonical **inline URL field**. URL is a normal labelled input above email/password, not a separate modal.
- No `useTenant()` import — `instanceUrl` is persisted directly via `authStore.login()` + `StorageKeys.instanceUrl`.
- No `authRepository` — read backup values via `storage.get(StorageKeys.emailBackup)` + `storage.get(StorageKeys.instanceUrl)` directly. Same one-time legacy `user_email` migration logic the authStore already does is unaffected here (this screen just reads the storage layer; the canonical key is what we pre-fill).
- Existing form behaviour preserved: trim email, require URL, require password, show submit-time errors below the password row.
- Biometric quick-unlock FAB shown only when `cookie && bioFlag === '1' && Biometric.isModuleAvailable()`. Tap → `Biometric.authenticate()` → on success: `hydrate()` + `unlock()` + `router.replace('/(app)/(tabs)/gate')`. On non-cancel error: show a generic "Couldn't verify biometric. Use your password." error.
- Footer: small centred `v{APP_VERSION}` line. No upande-quality branding text beyond the existing logo.
- Title prop on `Screen` is `"Upande Security"`. `hideMenu` set so the hamburger doesn't appear on the login screen.
- Successful password login: `router.replace('/(app)/(tabs)/gate')` (canonical routes to `/traceability` — that's upande-quality's home).

### `app/biometric-lock.tsx` — new (root level)

Direct adaptation of `upande-quality/app/biometric-lock.tsx`. The only substantive differences:

- Reads user info from `useAuthStore.user?.email` (no `fullName` / separate `email` fields in our store). Title shows email; falls back to "Welcome back".
- `Biometric.authenticate({ promptMessage: 'Unlock Upande Security', fallbackLabel: 'Use password', cancelLabel: 'Cancel' })`.
- Logo path `@/assets/images/upande_logo.png` (already correct in upande-security's repo).
- Layout, fab, error box, "Use password instead" link → `forgetDevice()` → `router.replace('/login')` are verbatim.

This screen does NOT mount inside any layout group — it's a sibling of `app/login.tsx`, `app/_layout.tsx`. The root layout's routing effect sends users here when `hasSession && biometricLocked && BIOMETRIC_LOCK_ROUTE_AVAILABLE`.

### `app/(app)/(tabs)/settings.tsx` — new (hidden tab, drawer-accessible)

Direct adaptation of `upande-quality/app/(tabs)/settings.tsx`. Four cards in order:

1. **Account** — avatar (single initial from email), email, instance URL. `fullName` reference dropped; everywhere the canonical reads `fullName || email`, we just read `user?.email`. `instanceUrl` line stays as-is (with `https?://` stripped).
2. **Security** — biometric toggle. State-aware hint string:
   - `!moduleReady` → "Install latest build to enable"
   - `!hardwareReady` → "Enroll fingerprint/face in device settings"
   - both ready → "Skip the password with fingerprint or face"
   - Toggle interaction (canonical, unchanged): if turning ON, require either module/hardware to be ready and a one-time biometric confirmation prompt with `disableDeviceFallback: true`; otherwise show appropriate Alert. On success, `setBiometricEnabled(!biometricEnabled)` + toast.
3. **App** — `appVersion` from `expo-constants`, `runtimeVersion` from `expo-updates` (shows runtime only if it differs from app version). "Check for updates" button: in `__DEV__` shows error toast "OTA updates are unavailable in development."; otherwise `Updates.checkForUpdateAsync` → if available, `fetchUpdateAsync` → Alert "Update ready" with Reload action that calls `Updates.reloadAsync()`. On no update, success toast "You're on the latest version."
4. **Session** — "Sign out" (Alert confirm → `logout()` → `/login`) + "Forget this device" (Alert confirm → `forgetDevice()` → `/login`). Visually distinguished — Forget button uses `color={COLORS.danger}` + trash icon.

Inline `Toggle` helper component reused verbatim (46×26 pill, 20×20 dot, OFF=`#E5E5E5`, ON=`COLORS.text`).

### `app/(app)/(tabs)/_layout.tsx` — modify

Add one hidden tab entry so the settings route exists without showing in the bottom bar:

```typescript
<Tabs.Screen
  name="settings"
  options={{ title: 'Settings', href: null }}
/>
```

No other change. Gate / Incidents / Patrol tabs untouched (their icons stay on MaterialIcons until Wave 4).

### `app/_layout.tsx` — modify (three edits)

1. **Flip the biometric routing flag:**
   ```typescript
   const BIOMETRIC_LOCK_ROUTE_AVAILABLE = true;
   ```
2. **Mount `<ToastProvider>`** between `<QueryClientProvider>` and `<StatusBar>`. The legacy `<Toast />` from `react-native-toast-message` stays alongside until Wave 4. Both coexist; new chrome uses `useToast`.
3. **Mount `<DrawerItemsProvider items={DRAWER_ITEMS}>`** wrapping the inner tree. Items:
   ```typescript
   import type { DrawerItem } from '@/src/core/ui/drawer-items-context';
   const DRAWER_ITEMS: DrawerItem[] = [
     { label: 'Gate', route: '(app)/(tabs)/gate', icon: 'log-in-outline' },
     { label: 'Incidents', route: '(app)/(tabs)/incidents', icon: 'warning-outline' },
     { label: 'Patrol', route: '(app)/(tabs)/patrol', icon: 'walk-outline' },
   ];
   ```
   Note: `SideMenu.go(route)` calls `router.replace(`/${route}` as never)`. With `route: '(app)/(tabs)/gate'`, the resulting path becomes `/(app)/(tabs)/gate` — the same path the post-login redirect uses. Confirmed routable.

### `app/(app)/_layout.tsx` — no change

Existing `isAuthenticated` redirect to `/login` is a defensive double-check. The root layout now owns auth routing, but keeping the inner redirect is harmless and protects against any future routing edge case. Skip touching this file.

## Routing flows after Wave 3

| Trigger | Outcome |
|---|---|
| Cold start, no cookie | Root layout routes to `/login` |
| Cold start, cookie + biometric OFF | Root layout routes to `/(app)/(tabs)/gate` |
| Cold start, cookie + biometric ON, native module present | Root layout routes to `/biometric-lock` → user prompts → `unlock()` → routes to `/(app)/(tabs)/gate` |
| Cold start, cookie + biometric ON, native module missing (old binary on OTA) | `Biometric.isModuleAvailable()` returns false → `biometricLocked` is false → routes straight to gate (degrades silently) |
| App backgrounded → foregrounded with cookie + biometric ON | AppState listener flips `biometricLocked=true` → root layout routes to `/biometric-lock` |
| User taps "Use password instead" on lock screen | `forgetDevice()` → `/login` |
| User taps biometric FAB on login | `Biometric.authenticate()` → `hydrate()` + `unlock()` → `/(app)/(tabs)/gate` |
| User taps Sign Out in Settings | Alert confirm → `logout()` (soft) → `/login`. Cookie + biometric flag preserved so user can return via biometric. |
| User taps Forget Device in Settings | Alert confirm → `forgetDevice()` (hard) → `/login`. Cookie + biometric flag wiped. |

## Implementation order

Six atomic commits, each `tsc --noEmit` clean:

1. `feat(layout): mount ToastProvider + DrawerItemsProvider in root layout` — wraps existing tree, no routing changes yet. The biometric-lock flag stays false.
2. `feat(login): rewrite to canonical inline URL + biometric FAB pattern` — replaces the Modal flow.
3. `feat(biometric-lock): add lock screen at app root` — new file.
4. `feat(layout): flip BIOMETRIC_LOCK_ROUTE_AVAILABLE to true` — now the lock route activates. The biometric-lock screen now mounted in step 3 starts handling cold-start routing.
5. `feat(tabs): register hidden settings route in (tabs) layout` — `href: null` entry, no UI visible yet.
6. `feat(settings): add Account/Security/App/Session settings screen` — uses the route registered in step 5. Uses `useToast` from the provider mounted in step 1.

## Verification

- Per commit: `tsc --noEmit` clean.
- After final commit: `npx expo export --platform ios --output-dir /tmp/wave3-final` succeeds.
- On-device smoke (development build because `expo-local-authentication` is a native module added in Wave 1):
  1. Cold start signed-in (no biometric): lands on gate.
  2. Drawer opens from Gate's hamburger; nav rows show Gate / Incidents / Patrol with Ionicons; Settings footer row visible; Sign Out works.
  3. Open Settings: avatar shows initial, email visible, instance URL visible. Biometric toggle hint shows correct state based on device hardware. Toggle ON → confirms via biometric prompt → toast.
  4. Background app → foreground → biometric lock screen appears, prompts, unlocks. "Use password instead" works too.
  5. Sign out from Settings → land on login → biometric FAB visible (cookie still on disk) → tap → biometric prompts → land on gate.
  6. "Check for updates" in dev build: toast "OTA updates are unavailable in development."

## Risks and rollback

- **Biometric prompt UX on device.** First time `Biometric.authenticate` runs on a device, OS-level enrollment must already be present. The 3-probe guard in `src/core/biometric/index.ts` (Wave 1) handles the missing-module case; the state hints in Settings handle missing enrollment. "Use password instead" link on lock + "Forget device" in settings give two paths out if anything jams.
- **Routing loop.** The root layout's routing effect runs on every segment change. We add a `first !== 'biometric-lock'` guard before navigating to the lock screen, and `first !== 'login'` before navigating to login. Same pattern that has worked since Wave 1.
- **ToastProvider above QueryClient.** Toast doesn't depend on react-query; provider order is `<ToastProvider><QueryClientProvider>`. Verified by reading both — neither depends on the other.
- **Step-5 commit creates a route that no UI uses.** That's fine — `href: null` makes it unreachable from the bottom bar, and step 6 will land the screen at that route before the wave ships.
- Each step is a separate commit. Single-step revert is trivial; whole wave reverts to the Wave 2 tip via `git reset --hard <wave2-tip>`.

## Non-goals / explicit out-of-scope for this wave

- No changes to any existing feature screen.
- No changes to `lib/`, `frappe/`, `components/ui/*`.
- No icon swap in bottom tabs.
- No retirement of `react-native-toast-message` / `useFeedback`.
- No additional Wave 1 / Wave 2 module changes.

## What follows

After Wave 3 ships:

- **Wave 4**: feature screen sweep. Every existing screen migrated to `Screen` + `Button` + `Card` primitives from `src/core/ui/*`, tokens, Ionicons. `useFeedback` swapped to `useToast`. `MaterialIcons` removed from bottom tabs. `components/ui/*` either deleted or aliased to canonical re-exports. After Wave 4, the visual unification is complete.
