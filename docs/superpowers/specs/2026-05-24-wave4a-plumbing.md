# Wave 4a — Plumbing: useFeedback → useToast + bottom tabs

**Status:** Draft
**Date:** 2026-05-24
**Owner:** upande-security
**Reference:** First of three sub-waves under Wave 4 (feature-screen migration). Subsequent: 4b (Patrol + Incidents screens), 4c (Gate area + components/ui retirement).
**Predecessors:**
- Wave 1: `docs/superpowers/specs/2026-05-24-wave1-design-system-foundation.md`
- Wave 2: `docs/superpowers/specs/2026-05-24-wave2-canonical-primitives.md`
- Wave 3: `docs/superpowers/specs/2026-05-24-wave3-canonical-chrome.md`

## Goal

Plumbing-only sub-wave: route every existing `useFeedback` caller through the canonical `useToast` so the new pill UI shows up across the entire app on the same commit, and migrate the bottom-tabs layout to the canonical Ionicons + AnimatedTabIcon pattern. No screen body is rewritten. After this wave, every toast is the canonical pill and the bottom-tab icons / spring animation match the SideMenu + chrome.

## Scope

**In scope**

1. Rewrite `lib/hooks/useFeedback.ts` to call `useToast()` internally. Preserve its `{ success, error, warning }` API surface so every existing caller works unchanged.
2. Drop `<Toast />` from `react-native-toast-message` in `app/_layout.tsx`. Remove the `react-native-toast-message` package from `package.json`.
3. Migrate `app/(app)/scan.tsx`'s audio import from `lib/services/sounds.ts` → `src/core/audio` (one line swap of `playBeep` → `audio.beep`). Do NOT touch its `MaterialIcons` usage — that's Wave 4c.
4. Delete `lib/services/sounds.ts` (no remaining callers after steps 1 and 3).
5. Rewrite `app/(app)/(tabs)/_layout.tsx` to use Ionicons outline/filled pairs + `AnimatedTabIcon` from `@/src/core/ui` + theme tokens. Hidden settings entry from Wave 3 preserved.

**Out of scope**

- Any feature-screen body (gate/incidents/patrol/scan/etc.) — bodies stay on their existing primitives until Wave 4b/4c. `scan.tsx`'s audio import is the only line of scan that changes; its UI is untouched.
- `components/ui/*` retirement — Wave 4c.
- `components/forms/*` — Wave 4b (when `incidents/new` is migrated).
- `app/(app)/_layout.tsx`, `gate/_layout.tsx`, `incidents/_layout.tsx`, `patrol/_layout.tsx` — Wave 4b/4c.
- Removing `expo-audio` dependency — it's still used by `src/core/audio`.
- Removing `expo-haptics` — useFeedback's `warning` branch still uses it.

## File-by-file

### `lib/hooks/useFeedback.ts` — full rewrite

```typescript
import * as Haptics from 'expo-haptics';
import { useToast } from '@/src/core/ui/Toast';

/**
 * Thin adapter that lets legacy callers keep the
 * `{ success, error, warning }` API while rendering through the canonical
 * useToast. Wave 4b/4c migrates the screens to call useToast directly.
 */
export function useFeedback() {
  const { showSuccess, showError, showInfo } = useToast();
  return {
    success: (message: string) => showSuccess(message),
    error: (message: string) => showError(message),
    warning: (message: string) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      showInfo(message);
    },
  };
}
```

The `useToast` hook plays the success/error sounds via `src/core/audio` internally, so the old `playSubmit/playError` calls become redundant — drop them. The `warning` branch's haptic feedback (`expo-haptics`) stays.

### `app/(app)/scan.tsx` — one-line import swap

Change the single import:

```typescript
// before
import { playBeep } from '@/lib/services/sounds';

// after
import { audio } from '@/src/core/audio';
```

And the single call site (`playBeep()` → `audio.beep()`). Everything else in scan.tsx untouched.

### `app/_layout.tsx` — drop `<Toast />`

Remove the import:

```typescript
import Toast from 'react-native-toast-message';
```

Remove the mount inside the JSX tree:

```jsx
<Toast />
```

The `<ToastProvider>` (Wave 3 Task 1) stays — that's the canonical provider. `useFeedback` now writes through it.

### `package.json` — remove `react-native-toast-message`

Drop the dependency entry. `package-lock.json` regenerates via `npm uninstall`. Run a final grep across `app/`, `components/`, `lib/`, `src/` to verify zero remaining imports.

### `lib/services/sounds.ts` — delete

After useFeedback (step 1) and scan.tsx (step 3) are migrated, this file has no callers. Delete.

### `app/(app)/(tabs)/_layout.tsx` — full rewrite

```typescript
import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, fontFamily, fontSize } from '@/src/core/theme';
import { AnimatedTabIcon } from '@/src/core/ui/AnimatedTabIcon';

type TabIconPair = {
  outline: keyof typeof Ionicons.glyphMap;
  filled: keyof typeof Ionicons.glyphMap;
};

const ICONS: Record<string, TabIconPair> = {
  gate:      { outline: 'log-in-outline', filled: 'log-in' },
  patrol:    { outline: 'walk-outline',   filled: 'walk' },
  incidents: { outline: 'warning-outline', filled: 'warning' },
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 64 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarItemStyle: { paddingTop: 4 },
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
        tabBarIcon: ({ focused, size }) => {
          const pair = ICONS[route.name];
          if (!pair) return <Ionicons name="help-outline" size={size} color={COLORS.textMuted} />;
          return (
            <AnimatedTabIcon
              outline={pair.outline}
              filled={pair.filled}
              focused={focused}
              size={size}
            />
          );
        },
      })}
    >
      <Tabs.Screen name="gate" options={{ title: 'Gate' }} />
      <Tabs.Screen name="patrol" options={{ title: 'Patrol' }} />
      <Tabs.Screen name="incidents" options={{ title: 'Incidents' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', href: null }} />
    </Tabs>
  );
}
```

Notes:
- Tab title for `gate` changes from "Check In" to "Gate" (matches the drawer label set in Wave 3's `DRAWER_ITEMS`).
- `tabBarShowLabel: true` (canonical upande-quality uses `false`; upande-security tabs currently show labels, and users are familiar with them). Stick with the existing behaviour.
- `AnimatedTabIcon` provides the spring + lift animation on focus, matching upande-quality.

## Implementation order

Four atomic commits, each `tsc --noEmit` clean:

1. `refactor(feedback): rewrite useFeedback to use canonical useToast` — hook rewrite only.
2. `chore(scan): swap audio import to src/core/audio` — one line in scan.tsx.
3. `chore(deps): remove react-native-toast-message + lib/services/sounds` — uninstall package, drop `<Toast />` mount in root layout, delete `lib/services/sounds.ts`.
4. `feat(tabs): migrate bottom-tabs to canonical Ionicons + AnimatedTabIcon` — rewrite `(tabs)/_layout.tsx`.

After commit 3 the visual toast change is live across the app. After commit 4 the bottom tabs match upande-quality's chrome.

## Verification

- `tsc --noEmit` clean after every commit.
- After commit 3: `grep -rn 'react-native-toast-message\|lib/services/sounds\|playBeep\|playSubmit\|playError' app components lib src --include="*.ts" --include="*.tsx" 2>/dev/null` returns empty. If any caller surfaces, STOP and surface.
- Metro export succeeds after commit 4.
- Manual on-device smoke:
  - Trigger a success toast (e.g. check in a visitor): canonical pill at top center, plays submit sound, dismisses ~2.6 s.
  - Trigger an error toast (force a check-in failure): pill, plays error sound, dismisses ~5 s.
  - Tap each bottom tab: AnimatedTabIcon springs to 1.2× on focus, outline → filled icon swap.
  - Settings still accessible from the drawer (not visible in bottom tabs).

## Risks and rollback

- **Missing useFeedback caller.** If grep missed a caller of `playSubmit/playError`, removing `sounds.ts` will break compile. Mitigation: the post-step grep in Verification catches it.
- **Toast layout regression.** The canonical pill is centered-top; the legacy `react-native-toast-message` shows top-edge bubbles. Users will notice the visual change. Per the user's accepted scope, this is intentional.
- **Bottom-tab title rename.** "Check In" → "Gate" is a label change for the gate tab. Matches the SideMenu drawer label; consistent with the rest of the app.
- Each commit is independently revertable. Whole wave reverts via `git reset --hard <wave3-tip>`.

## Non-goals

- No screen body changes.
- No `components/*` changes.
- No `frappe/` changes.
- No theme / token changes (those landed in Wave 1).

## What follows

After Wave 4a ships:

- **Wave 4b**: brainstorm cycle for Patrol + Incidents screens. Migrate `patrol/_layout`, `patrol/index`, `patrol/active`, `incidents/_layout`, `incidents/index`, `incidents/new`, plus the `components/forms/*` used by `incidents/new`.
- **Wave 4c**: Gate area — `gate/_layout`, `gate/summary`, `gate/pending`, `gate/approved`, `gate/index`, all 16 `components/gate/*` files, `app/(app)/scan.tsx`'s UI body. Plus retiring overlapping `components/ui/*` (alias to `src/core/ui/*` or delete).
