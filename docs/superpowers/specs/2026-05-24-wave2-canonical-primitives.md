# Wave 2 — Canonical primitives

**Status:** Draft
**Date:** 2026-05-24
**Owner:** upande-security
**Reference:** Wave 2 of the 4-wave migration aligning upande-security with upande-quality + mobile-app-blueprint.html §15/§16.
**Predecessor:** Wave 1 (`docs/superpowers/specs/2026-05-24-wave1-design-system-foundation.md`) landed the theme, storage, biometric, network, version, and authStore modules.

## Goal

Add the canonical UI primitives (`Screen`, `Button`, `Card`, `Toast`, `SideMenu`, etc.) and the audio module at `src/core/ui/*` and `src/core/audio/*`. These are the building blocks Waves 3 and 4 will consume. No existing screen or primitive is touched in this wave — pure addition, zero visual change today.

## Scope

**In scope**

1. New `src/core/audio/index.ts` — ports the canonical audio module, plays `submit.mp3` / `error.mp3` / `beep.mp3` from `assets/sounds/`.
2. New `src/core/ui/` tree with 16 primitives. 14 are verbatim copies from upande-quality (12 leaf primitives + `Toast` + `Screen`); 2 are adapted for upande-security (`drawer-items-context.tsx`, `SideMenu.tsx`).
3. `tsc --noEmit` clean after every commit. One final `expo export` to confirm Metro bundles cleanly.

**Out of scope (Waves 3–4)**

- Login screen rewrite, biometric-lock screen, settings screen, drawer wiring — Wave 3.
- Sweeping existing screens (`gate/*.tsx`, `incidents/*.tsx`, `patrol/*.tsx`, etc.) to use the new primitives — Wave 4.
- Replacing `components/ui/*` with re-exports of `src/core/ui/*` — explicitly deferred; the user accepted the pure-additive scope.
- Replacing `react-native-toast-message` usage in `useFeedback` — Wave 4.
- Introducing primitives not present in upande-quality's `src/core/ui/` (`EmptyState`, `SectionHeader`, custom `StatCard`) — Wave 4 if needed.
- `PendingScreen` (multi-tenant gating screen, not relevant to single-tenant upande-security).

## Folder additions

```
src/core/audio/index.ts
src/core/ui/
├── AnimatedTabIcon.tsx
├── Button.tsx
├── Card.tsx                      # also exports Alert
├── DecisionChip.tsx
├── Dropdown.tsx
├── FAB.tsx
├── Input.tsx
├── LabeledInput.tsx
├── OfflineBanner.tsx
├── ProgressBar.tsx
├── Screen.tsx
├── Segmented.tsx
├── SideMenu.tsx
├── Spinner.tsx
├── Toast.tsx
└── drawer-items-context.tsx
```

Total: 17 new files (16 UI + 1 audio), ~1,600 LoC.

## Audio module

`src/core/audio/index.ts` ports upande-quality's audio module verbatim except for the asset paths and the inclusion of `beep`:

```typescript
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

const sources = {
  beep:   require('@/assets/sounds/beep.mp3'),
  submit: require('@/assets/sounds/submit.mp3'),
  error:  require('@/assets/sounds/error.mp3'),
} as const;

type SoundKey = keyof typeof sources;
const players: Partial<Record<SoundKey, AudioPlayer>> = {};

function getPlayer(key: SoundKey): AudioPlayer {
  let p = players[key];
  if (!p) {
    p = createAudioPlayer(sources[key]);
    players[key] = p;
  }
  return p;
}

function play(key: SoundKey) {
  try {
    const p = getPlayer(key);
    p.seekTo(0);
    p.play();
  } catch {
    // sound is non-critical
  }
}

export const audio = {
  beep:   () => play('beep'),
  submit: () => play('submit'),
  error:  () => play('error'),
};
```

The existing `lib/services/sounds.ts` keeps working for legacy `useFeedback` consumers; both can coexist until Wave 4.

## Primitives — verbatim ports

These twelve files are direct byte-for-byte copies from `/home/jk/Projects/upande-quality/src/core/ui/*`:

- `AnimatedTabIcon.tsx` (47 LoC) — animated outline/filled Ionicon for bottom tabs.
- `Button.tsx` (78 LoC) — variants `primary` / `outline` / `ghost`, `iconLeft`, `loading`, `disabled`. Pill radius.
- `Card.tsx` (90 LoC) — `Card` + `Alert` (with tones `info`/`success`/`warn`/`danger`).
- `DecisionChip.tsx` (44 LoC) — selectable pill chip.
- `Dropdown.tsx` (204 LoC) — bottom-sheet picker with search.
- `FAB.tsx` (122 LoC) — 64×64 white floating action button with hairline border.
- `Input.tsx` (49 LoC) — basic input with optional Ionicon adornment.
- `LabeledInput.tsx` (64 LoC) — input with a label above.
- `OfflineBanner.tsx` (81 LoC) — sticky banner reading from `useNetworkStore`.
- `ProgressBar.tsx` (31 LoC) — thin progress bar.
- `Segmented.tsx` (115 LoC) — segmented control.
- `Spinner.tsx` (37 LoC) — centred activity indicator.

## Primitives — adapted

### 1. `drawer-items-context.tsx`

upande-quality's version imports a `DrawerItem` whose `route` is a literal-union of upande-quality routes (`'traceability' | 'replacement' | ...`). For upande-security we define `DrawerItem` locally with a generic shape:

```typescript
import { createContext, useContext, type ReactNode } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type DrawerItem = {
  /** Display label shown in the menu row. */
  label: string;
  /** Any route path under `app/` (e.g. 'incidents', 'gate', 'settings'). */
  route: string;
  /** Ionicons name rendered next to the label. */
  icon: keyof typeof Ionicons.glyphMap;
};

const DrawerItemsContext = createContext<DrawerItem[]>([]);

export function DrawerItemsProvider({
  items,
  children,
}: {
  items: DrawerItem[];
  children: ReactNode;
}) {
  return <DrawerItemsContext.Provider value={items}>{children}</DrawerItemsContext.Provider>;
}

export function useDrawerItems(): DrawerItem[] {
  return useContext(DrawerItemsContext);
}
```

The `icon` field is now part of each item, so `SideMenu` no longer needs a `ROUTE_ICONS` lookup table.

### 2. `SideMenu.tsx`

Adapted from upande-quality with five upande-security-specific changes:

| What | Was (upande-quality) | Becomes (upande-security) |
|---|---|---|
| Tenant context | `const { tenant, instanceUrl } = useTenant();` + meta line `tenant · instanceUrl` | Remove `useTenant`. Read `instanceUrl` from `useAuthStore`. Meta line shows only `instanceUrl` (sans `https://`). |
| Per-route icons | `ROUTE_ICONS[item.route]` lookup against a hardcoded union | Use `item.icon` directly from the `DrawerItem` |
| User name + email state | `useAuthStore.fullName` + `useAuthStore.email` + fallback to `StorageKeys.fullName` / `StorageKeys.emailBackup` | Read from `useAuthStore.user?.email`. No `fullName` in store yet — initials and header text both derive from email. Fallback reads `StorageKeys.emailBackup`. |
| Configure station footer row | Present | Removed |
| Brand text | `"Upande Quality v{APP_VERSION}"` | `"Upande Security v{APP_VERSION}"` |

The animation, layout, colours, accessibility, and "Sign Out" → `forgetDevice`-style behaviour all stay identical. (The existing `logout` action is soft — that matches canonical `Settings.tsx`'s "Sign out" path. `forgetDevice` is for "Forget device" elsewhere.)

### 3. `Toast.tsx`

Verbatim copy — but the audio import path resolves to our new `src/core/audio/index.ts` which has the same surface (`audio.submit`, `audio.error`). No code changes beyond that resolution.

## Implementation order

Atomic commits, each `tsc --noEmit` clean before the next. Order matters because composites depend on leaves:

1. `feat(audio): add audio module at src/core/audio`
2. `feat(ui): add Button primitive`
3. `feat(ui): add Card + Alert primitives`
4. `feat(ui): add Spinner primitive`
5. `feat(ui): add ProgressBar primitive`
6. `feat(ui): add Input primitive`
7. `feat(ui): add LabeledInput primitive`
8. `feat(ui): add Segmented primitive`
9. `feat(ui): add DecisionChip primitive`
10. `feat(ui): add FAB primitive`
11. `feat(ui): add AnimatedTabIcon primitive`
12. `feat(ui): add OfflineBanner primitive`
13. `feat(ui): add Dropdown primitive`
14. `feat(ui): add Toast + ToastProvider`
15. `feat(ui): add DrawerItem type + DrawerItemsProvider`
16. `feat(ui): add SideMenu (adapted for upande-security)`
17. `feat(ui): add Screen primitive`

17 commits. Each commit adds exactly one new file. (Commit 3, `Card.tsx`, exports both `Card` and `Alert` from the same file — still one file added.)

## Verification

- `tsc --noEmit` clean after every commit.
- `npx expo export --platform ios --output-dir /tmp/wave2-final` succeeds after the final commit.
- No commits touch existing `components/ui/*`, `app/*`, or `lib/*` files. Each commit's `git show --name-only` lists only the new file(s).
- Pre-existing uncommitted changes (gate_activity work) remain untouched in the working tree.

## Risks

- **Metro bundling.** Primitives are React Native + Ionicons + theme; nothing exotic. Risk of bundle failure: very low.
- **Tree-shaking concern: dead code.** None of these primitives are imported anywhere yet. Metro will not include them in the bundle when nothing references them, so bundle size is unchanged until Wave 3/4. (Verified by checking that nothing in `app/_layout.tsx` or any screen imports from `src/core/ui/*` after Wave 1 lands.)
- **TypeScript namespace collisions.** `Card` and `Button` exist in both `components/ui/` and the new `src/core/ui/`. They're never imported together (existing screens use `components/ui/`; future code uses `src/core/ui/`). No collision.
- **SideMenu adaptation drift.** The adapted SideMenu is a one-time fork from upande-quality. If upande-quality updates its SideMenu, we'd need to re-sync manually. Acceptable for now; can revisit when the design system is more mature.

## Rollback

Every commit is a single new-file commit (or one composite — commit 15 + 16 + 17 share a logical dependency chain). Any single commit reverts cleanly with `git revert`. The whole wave reverts with `git reset --hard <wave1-tip>` if needed.

## What follows

After Wave 2 ships:

- **Wave 3** brainstorm: canonical chrome screens. Rewrite `app/login.tsx`, add new `app/biometric-lock.tsx`, add `app/(app)/(tabs)/settings.tsx` with Fetch Updates. Mount the drawer (via `Screen` already imports `SideMenu`). Flip `BIOMETRIC_LOCK_ROUTE_AVAILABLE` to `true` in `app/_layout.tsx` so the lock screen actually routes. Provide a `DrawerItemsProvider` at the app root with upande-security's actual nav list.
- **Wave 4**: feature screen sweep — every existing screen migrated to `Screen` + `Button` + `Card` primitives, theme tokens, Ionicons. `useFeedback` swapped to `useToast`.
