# Wave 1 — Design system foundation

**Status:** Draft
**Date:** 2026-05-24
**Owner:** upande-security
**Reference:** Wave 1 of a 4-wave migration to align upande-security visually and structurally with upande-quality + mobile-app-blueprint.html §16/§17/§18.

## Goal

Land all non-visible plumbing the canonical design system depends on, without changing how any existing screen looks today. After this wave, the app still renders exactly as it does now — but auth, fonts, biometric, storage, network and theme are in place so Waves 2–4 can drop in the canonical primitives and chrome with no surprises.

## Scope

**In scope**

1. New `src/core/` tree mirroring upande-quality.
2. Canonical theme tokens (palette, typography, spacing, radius, shadow).
3. DM Sans + Poppins fonts loaded at boot via `useFonts` with splash held until ready.
4. Storage wrapper + typed `StorageKeys`.
5. Biometric service with safe no-op fallback for builds without the native module.
6. Network store backed by NetInfo.
7. Auth store extension: `hydrated`, `hasSession`, `biometricEnabled`, `biometricLocked`, plus `unlock()`, `forgetDevice()`, `setBiometricEnabled()`. Preserve all existing fields and existing call sites.
8. Version module exporting `APP_VERSION` constant.
9. Root layout rewrite: font gate, splash management, hydration, biometric routing (login / biometric-lock / app).
10. Package.json adjustments — add fonts + biometric, remove unused NativeWind/Tailwind.

**Out of scope (deferred to Waves 2–4)**

- New `Screen` / `Button` / `Card` / `SideMenu` / `Toast` / `Dropdown` / `Input` primitives. Wave 2.
- The actual login redesign, biometric-lock screen, settings screen with Fetch Updates, drawer wiring. Wave 3.
- Sweeping every existing screen to use new primitives + tokens + Ionicons. Wave 4.
- Folder-level renames beyond what's required to populate `src/core/`. Existing `components/`, `lib/`, `constants/`, `app/` stay put.

## Folder layout

Adopt `src/core/` from upande-quality, parallel to existing layout. We are **not** moving existing folders in this wave — only adding the new tree.

```
src/
└── core/
    ├── theme/index.ts          # tokens (palette, fonts, spacing, radius, shadow)
    ├── storage/index.ts        # AsyncStorage wrapper + StorageKeys
    ├── biometric/index.ts      # safe wrapper around expo-local-authentication
    ├── network/store.ts        # Zustand network store + init()
    ├── version/index.ts        # APP_VERSION
    └── auth/
        └── store.ts            # re-exports the in-place-extended lib/stores/authStore.ts
```

The existing `lib/stores/authStore.ts` is the source of truth today. Wave 1 introduces `src/core/auth/store.ts` that imports and re-exports the existing store, then adds the new fields/actions. New code imports from `@/src/core/auth/store`. Old call sites can be migrated incrementally in subsequent waves; nothing breaks during the migration window.

Existing `constants/theme.ts` (mostly `#000000` placeholders) is left in place but unused by new code. Wave 4 removes it once no callers remain.

## Tokens — `src/core/theme/index.ts`

Copy upande-quality's theme verbatim. Verbatim because the blueprint §16 calls this "non-negotiable" and the file already contains the canonical palette + typography + spacing + radius + shadow.

Public exports (used by every component going forward):

- `COLORS` — single source of truth for surfaces, text, status, chrome. Strict monochrome with three status hues (`success`, `warn`, `danger`). The legacy `colors` alias is kept temporarily for files we haven't migrated.
- `spacing` — `{ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }`.
- `borderRadius` — `{ sm: 6, md: 10, lg: 14, xl: 20, full: 9999 }`. Also exposed as `radius` for compatibility.
- `fontFamily` — DM Sans (regular, medium) + Poppins (semiBold, bold).
- `fontSize` — `{ xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28 }`.
- `typography` — pre-baked text styles (h1/h2/h3/body/bodySmall/caption/label/mono).
- `shadow.sm` / `shadow.md` — two tiers, nothing heavier.

No domain accent colors. If a screen needs to highlight a status (e.g. patrol active / inactive), it uses `COLORS.success`/`warn`/`danger` only.

## Fonts — `app/_layout.tsx`

Load with `@expo-google-fonts/dm-sans` + `@expo-google-fonts/poppins`. Gate render on `fontsLoaded && hydrated`; hold the native splash until both resolve via `SplashScreen.preventAutoHideAsync()` + `SplashScreen.hideAsync()`.

Files referencing `Poppins_*` from the existing `@expo-google-fonts/poppins` install continue to work — we add the DM Sans variants alongside.

## Storage wrapper — `src/core/storage/index.ts`

Direct copy from upande-quality. Single named export `storage` with `get` / `set` / `remove` / `clearExcept`, plus `StorageKeys` enum object. Same key names so that data already written by the existing app (`cookie`, `instanceurl`, `email_backup`, `fullname`, `userRoles`) is read back correctly on first launch.

New key added: `biometric_enabled` (string `'0'` / `'1'`).

Existing files in `lib/` that currently call `AsyncStorage` directly are not migrated in this wave; they keep working. New code uses the wrapper.

## Biometric service — `src/core/biometric/index.ts`

Direct copy from upande-quality. Implements the three-way native-module probe (`expo-modules-core`, `NativeModules`, `TurboModuleRegistry`) before importing `expo-local-authentication`, so an OTA bundle that loads on an older binary won't crash at the native layer.

Exports: `isModuleAvailable()`, `hasHardware()`, `isEnrolled()`, `isAvailable()`, `authenticate(opts)`.

Failure modes return `{ success: false, error: 'biometric_unavailable' | 'auth_failed' | <native error> }` — never throw.

## Network store — `src/core/network/store.ts`

Zustand store with `online: boolean` + `init()` action that subscribes to `@react-native-community/netinfo`. Provides the data the canonical `OfflineBanner` (Wave 2) consumes. `init()` is idempotent and called once from the root layout.

The existing `@react-native-community/netinfo` dependency stays.

## Version module — `src/core/version/index.ts`

Single export: `APP_VERSION` read from `Constants.expoConfig?.version`. No server reporting in this wave (deferred to a later wave if needed; the canonical app's `reportVersionIfDue` is optional).

## Auth store extension — `src/core/auth/store.ts`

The change happens to `lib/stores/authStore.ts` **in place** — we replace the store body with the canonical shape, adding new fields/actions while keeping every field the existing app already reads from. We then add `src/core/auth/store.ts` as a thin re-export of the same `useAuthStore` hook so new code (the upcoming Wave 3 screens) can import from the canonical path. Old call sites (`@/lib/stores/authStore`) keep working; they get migrated mechanically in later waves.

New / changed fields on the store:

| Field / action | Type | Purpose |
|---|---|---|
| `hydrated` | `boolean` | True once `hydrate()` resolves. Root layout waits on it before routing. |
| `hasSession` | `boolean` | True when a cookie is on disk. Drives login redirect. |
| `biometricEnabled` | `boolean` | Per-device toggle from Settings. Persists as `'0'`/`'1'`. |
| `biometricLocked` | `boolean` | Runtime gate. True when the biometric-lock screen should show. |
| `unlock()` | action | Sets `biometricLocked = false`. Called after a successful prompt. |
| `setBiometricEnabled(on)` | action | Writes `StorageKeys.biometricEnabled`, updates state. |
| `forgetDevice()` | action | Hard logout — clear cookie, roles, biometric flag, in-memory state. |
| `logout()` | action | **Soft** logout — keeps cookie + biometric flag so user can biometric-unlock. Existing screens' "Sign out" stays soft. |

Hydration logic (called once from root layout):

1. Read cookie, roles, email, instance URL, biometric flag.
2. `hasSession = !!cookie`.
3. `biometricEnabled = (flag === '1')`.
4. `biometricLocked = hasSession && biometricEnabled && Biometric.isModuleAvailable()`.
5. Set `hydrated = true`.

AppState listener: when app transitions from `background` → `active`, if `hasSession && biometricEnabled && Biometric.isModuleAvailable()`, set `biometricLocked = true`. Registered once in the root layout.

## Root layout — `app/_layout.tsx`

Replace the existing root layout with the canonical shape. The current root just renders a `<Stack>`; the new one:

1. Calls `SplashScreen.preventAutoHideAsync()` at module load.
2. Inside the component:
   - `useFonts({ DMSans_400Regular, DMSans_500Medium, Poppins_600SemiBold, Poppins_700Bold })`.
   - On first render: `hydrate()` from auth store + `init()` from network store.
   - Effect: once `fontsLoaded && hydrated`, call `SplashScreen.hideAsync()`.
   - Routing effect: react to `hasSession` / `biometricLocked` and call `router.replace('/login' | '/biometric-lock' | '/(app)/(tabs)/gate')` as appropriate.
3. Wraps the tree in `GestureHandlerRootView` → `SafeAreaProvider` → `<Stack screenOptions={{ headerShown: false }}>`.
4. Registers the AppState listener for re-lock-on-foreground.

The existing `app/index.tsx` redirect is removed — root layout owns auth routing now.

For Wave 1, the biometric-lock route does not yet exist as a screen — we conditionally route to it only after Wave 3. To prevent a broken redirect, Wave 1 gates the `biometricLocked` branch behind `false` (TODO comment marks the line) until Wave 3 lands the screen. The state flag is still set correctly; only the routing is deferred.

## Package changes

**Add:**

- `@expo-google-fonts/dm-sans` (matches upande-quality version)
- `expo-local-authentication` (matches upande-quality)

**Remove:**

- `nativewind`
- `tailwindcss`

NativeWind is currently declared but not imported in any screen (verified by grep). Removing it shrinks the bundle and avoids ambiguity about whether new code should use it. If a single import surfaces during the change, we restore both packages immediately.

`@expo-google-fonts/poppins` is already installed.

## Implementation order

Atomic commits, in this order:

1. `feat(theme): add canonical theme tokens at src/core/theme` — copy file, no callers yet.
2. `feat(storage): add storage wrapper at src/core/storage` — copy file, no callers yet.
3. `feat(biometric): add biometric service at src/core/biometric` — copy file, no callers yet.
4. `feat(network): add network store at src/core/network` — copy file, no callers yet.
5. `feat(version): add version module at src/core/version` — copy file, no callers yet.
6. `chore(deps): add dm-sans + expo-local-authentication, remove nativewind` — one package.json edit.
7. `feat(auth): extend authStore with biometric + hydration` — modify `lib/stores/authStore.ts` in place to add new fields/actions. Re-export from `src/core/auth/store.ts`.
8. `feat(layout): root layout — fonts, splash, hydration, app-state listener` — rewrite `app/_layout.tsx`, delete `app/index.tsx`.

Each commit `tsc --noEmit` clean before the next. After the final commit the app is run once on a real device to confirm:

- Splash holds until fonts load.
- Login still works on cold start (existing flow, unchanged UI).
- Foregrounding the app does not crash (even though biometric routing is gated off).
- Bottom-tabs and screens render exactly as before.

## Verification

- `tsc --noEmit` passes on every commit.
- `npm run lint` passes (eslint-config-expo).
- Manual smoke on Android dev build: sign in, navigate to each existing screen (Gate, Visits, Approved, Summary, Incidents, Patrol), background and foreground the app. No regressions.
- Storage compatibility check: install the new build over the current one; existing `cookie` / `email_backup` / `instanceurl` are read back; user does not need to re-login.

## Risk and rollback

- **Splash hangs.** If `useFonts` errors silently the splash never hides. Mitigation: `setTimeout(SplashScreen.hideAsync, 5000)` safety net in the root layout effect; remove once we trust the path.
- **expo-local-authentication missing on existing binaries.** Anyone running the current production APK who pulls this OTA bundle would lack the native module. The biometric service's three-probe guard returns `null` cleanly; nothing else in Wave 1 calls into it. Verified safe.
- **NativeWind silently used somewhere we missed.** Pre-removal commit: `grep -rn "className=" app/ components/ lib/ --include="*.tsx"`. If zero matches, removal is safe; if any, we keep NativeWind and migrate those usages in a separate step.
- **Rollback.** Each step is a separate commit. A single `git revert` restores the prior state for that step.

## Non-goals / explicit out-of-scope for this wave

- No new screen renders. No primitives. No icon swap. No screen redesign.
- No drawer wiring. No biometric-lock screen. No Settings screen. No login redesign.
- No `components/ui/*` deletions or moves. No `constants/theme.ts` deletion.
- No `MaterialIcons` → `Ionicons` changes anywhere.
- No `frappe/` changes.

## What follows

After Wave 1 ships:

- **Wave 2** brainstorm: canonical primitives at `src/core/ui/*` (Screen, Button, Card, SideMenu, Toast, Input, Dropdown, FAB, Spinner, ProgressBar, Segmented, OfflineBanner, Alert, EmptyState, StatCard, SectionHeader). Drop-in copies from upande-quality, then update imports across the app.
- **Wave 3**: canonical chrome — `login.tsx` rewrite, new `biometric-lock.tsx`, new `settings.tsx` with Fetch Updates, drawer wiring.
- **Wave 4**: feature screen sweep — every screen migrated to Screen/Button/Card primitives, tokens, Ionicons.
