# Wave 2 — Canonical Primitives: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 17 new files (16 UI primitives + 1 audio module) at `src/core/ui/*` and `src/core/audio/*`. Pure addition — no existing screen or primitive is touched. After this wave the app still renders exactly as it does today; Waves 3 and 4 consume the new primitives.

**Architecture:** Mirror upande-quality's `src/core/ui/` library. Twelve primitives are byte-for-byte copies; two (drawer-items-context, SideMenu) are adapted for upande-security (generic DrawerItem type, no tenant context, branded for Upande Security). Toast and Screen ports route their dependencies (audio, SideMenu) to the new local paths. The audio module ports verbatim against existing `assets/sounds/*.mp3`.

**Tech Stack:** React Native 0.81, Expo SDK 54, Zustand 5, expo-audio, expo-router, @expo/vector-icons (Ionicons + MaterialCommunityIcons), react-native-safe-area-context.

**Reference spec:** `docs/superpowers/specs/2026-05-24-wave2-canonical-primitives.md`

---

## Pre-flight

- [ ] **Step 0.1: Confirm baseline**

Run:
```bash
cd /home/jk/Projects/upande-security
git status --short
git log --oneline -3
npx tsc --noEmit 2>&1 | tail -5
```

Expected: HEAD at `627df8f` (Wave 2 spec) or later. `tsc --noEmit` clean. Several pre-existing uncommitted files (`gate/_layout.tsx`, `gate/pending.tsx`, etc.) are fine — they're unrelated to Wave 2 and DO NOT TOUCH them.

- [ ] **Step 0.2: Confirm sound assets exist**

Run:
```bash
ls -la /home/jk/Projects/upande-security/assets/sounds/
```

Expected: three files — `beep.mp3`, `error.mp3`, `submit.mp3`. If any are missing, STOP and report.

- [ ] **Step 0.3: Confirm Wave 1 modules exist**

Run:
```bash
ls -la /home/jk/Projects/upande-security/src/core/theme/index.ts \
       /home/jk/Projects/upande-security/src/core/version/index.ts \
       /home/jk/Projects/upande-security/src/core/network/store.ts \
       /home/jk/Projects/upande-security/src/core/storage/index.ts \
       /home/jk/Projects/upande-security/lib/stores/authStore.ts
```

Expected: all five files present. Wave 2 imports from these paths.

---

## Task 1: Audio module

**Files:**
- Create: `src/core/audio/index.ts`

- [ ] **Step 1.1: Create directory**

Run:
```bash
mkdir -p /home/jk/Projects/upande-security/src/core/audio
```

- [ ] **Step 1.2: Create `src/core/audio/index.ts`**

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

- [ ] **Step 1.3: Type-check**

```bash
cd /home/jk/Projects/upande-security && npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 1.4: Commit**

```bash
cd /home/jk/Projects/upande-security
git add src/core/audio/index.ts
git diff --staged --stat
git commit -m "$(cat <<'EOF'
feat(audio): add audio module at src/core/audio

Port from upande-quality. Lazy-loads beep/submit/error mp3 players via
expo-audio; play() is fire-and-forget and swallows errors (sound is
non-critical). Coexists with the existing lib/services/sounds.ts —
Wave 4 will migrate useFeedback to the new Toast which uses this module.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Button primitive

**Files:**
- Create: `src/core/ui/Button.tsx`

- [ ] **Step 2.1: Create directory**

```bash
mkdir -p /home/jk/Projects/upande-security/src/core/ui
```

- [ ] **Step 2.2: Create `src/core/ui/Button.tsx`**

```typescript
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  label: string;
  onPress?: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  iconLeft?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  color = COLORS.primary,
  disabled,
  loading,
  variant = 'primary',
  iconLeft,
  style,
}: Props) {
  const isDisabled = !!disabled || !!loading;
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const bg = isOutline || isGhost ? 'transparent' : color;
  const fg = isOutline || isGhost ? color : COLORS.textOnPrimary;
  const borderColor = isGhost ? 'transparent' : color;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        s.btn,
        {
          backgroundColor: bg,
          borderColor,
          opacity: isDisabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.inner}>
          {iconLeft ? <Ionicons name={iconLeft} size={18} color={fg} /> : null}
          <Text style={[s.label, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: fontFamily.bold, fontSize: fontSize.md },
});
```

- [ ] **Step 2.3: Type-check**

```bash
cd /home/jk/Projects/upande-security && npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 2.4: Commit**

```bash
cd /home/jk/Projects/upande-security
git add src/core/ui/Button.tsx
git commit -m "feat(ui): add Button primitive

Verbatim port from upande-quality. Variants primary/outline/ghost,
optional Ionicons iconLeft, loading + disabled states. Pill radius.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Card + Alert primitives

**Files:**
- Create: `src/core/ui/Card.tsx`

- [ ] **Step 3.1: Create `src/core/ui/Card.tsx`**

```typescript
import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

export function Card({
  title,
  children,
  style,
}: {
  title?: string;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.card, style]}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

type AlertTone = 'info' | 'success' | 'warn' | 'danger';

const TONE_BG: Record<AlertTone, string> = {
  info: '#EEF2FF',
  success: '#F0FDF4',
  warn: '#FFFBEB',
  danger: '#FEF2F2',
};
const TONE_FG: Record<AlertTone, string> = {
  info: '#3730A3',
  success: '#166534',
  warn: '#92400E',
  danger: '#991B1B',
};
const TONE_ICON: Record<AlertTone, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
  warn: 'warning-outline',
  danger: 'alert-circle-outline',
};

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: AlertTone;
  children: ReactNode;
}) {
  return (
    <View style={[s.alert, { backgroundColor: TONE_BG[tone] }]}>
      <Ionicons name={TONE_ICON[tone]} size={16} color={TONE_FG[tone]} style={{ marginTop: 1 }} />
      <Text style={[s.alertText, { color: TONE_FG[tone] }]}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.md,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  alertText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
});
```

- [ ] **Step 3.2: Type-check**

```bash
cd /home/jk/Projects/upande-security && npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 3.3: Commit**

```bash
cd /home/jk/Projects/upande-security
git add src/core/ui/Card.tsx
git commit -m "feat(ui): add Card + Alert primitives

Verbatim port from upande-quality. Card is a hairline-bordered surface
with an optional uppercase title. Alert is a colored info/success/warn/
danger banner with Ionicons leading icon.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Spinner primitive

**Files:**
- Create: `src/core/ui/Spinner.tsx`

- [ ] **Step 4.1: Create `src/core/ui/Spinner.tsx`**

```typescript
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

interface SpinnerProps {
  label?: string;
  size?: 'small' | 'large';
  inline?: boolean;
  color?: string;
}

/** Standard loading affordance — centred ActivityIndicator with an optional
 *  label below. Use `inline` for a compact row-style spinner. */
export function Spinner({ label, size = 'small', inline, color }: SpinnerProps) {
  const tint = color ?? COLORS.text;
  if (inline) {
    return (
      <View style={s.inline}>
        <ActivityIndicator size={size} color={tint} />
        {label ? <Text style={s.inlineLabel}>{label}</Text> : null}
      </View>
    );
  }
  return (
    <View style={s.block}>
      <ActivityIndicator size={size} color={tint} />
      {label ? <Text style={s.label}>{label}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  block: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textMuted },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inlineLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textMuted },
});
```

- [ ] **Step 4.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/Spinner.tsx
git commit -m "feat(ui): add Spinner primitive

Verbatim port from upande-quality. Block (centred) or inline (row)
ActivityIndicator with optional label.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: ProgressBar primitive

**Files:**
- Create: `src/core/ui/ProgressBar.tsx`

- [ ] **Step 5.1: Create `src/core/ui/ProgressBar.tsx`**

```typescript
import { StyleSheet, View } from 'react-native';
import { COLORS } from '@/src/core/theme';

type Props = {
  /** 0..1+ — values above 1 are clamped visually but the colour reflects "exceeded". */
  value: number;
  exceeded?: boolean;
  height?: number;
};

export function ProgressBar({ value, exceeded, height = 6 }: Props) {
  const clamped = Math.max(0, Math.min(value, 1.5));
  const widthPct = (clamped / 1.5) * 100;
  return (
    <View style={[s.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          s.fill,
          { width: `${widthPct}%`, height, borderRadius: height / 2 },
          exceeded ? s.fillExceeded : null,
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  track: { backgroundColor: COLORS.border, overflow: 'hidden' },
  fill: { backgroundColor: COLORS.text },
  fillExceeded: { backgroundColor: COLORS.danger },
});
```

- [ ] **Step 5.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/ProgressBar.tsx
git commit -m "feat(ui): add ProgressBar primitive

Verbatim port from upande-quality. 0..1.5 value range with 'exceeded'
state recoloring the fill to danger.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Input primitive

**Files:**
- Create: `src/core/ui/Input.tsx`

- [ ] **Step 6.1: Create `src/core/ui/Input.tsx`**

```typescript
import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, style, ...rest },
  ref,
) {
  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={COLORS.textMuted}
        style={[s.input, error ? s.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: COLORS.text,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  inputError: { borderColor: COLORS.danger },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.danger, marginTop: spacing.xs },
});
```

- [ ] **Step 6.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/Input.tsx
git commit -m "feat(ui): add Input primitive

Verbatim port from upande-quality. forwardRef'd TextInput with optional
label above and inline error message below.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: LabeledInput primitive

**Files:**
- Create: `src/core/ui/LabeledInput.tsx`

- [ ] **Step 7.1: Create `src/core/ui/LabeledInput.tsx`**

```typescript
import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = TextInputProps & {
  label: string;
  /** MaterialCommunityIcons glyph name — kept on MCI for backwards-compat with
   *  the many feature screens that pass MCI names. New code targeting fresh
   *  apps should prefer Ionicons via the new primitives. */
  iconName?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

export const LabeledInput = forwardRef<TextInput, Props>(function LabeledInput(
  { label, iconName, style, ...rest },
  ref,
) {
  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.field}>
        {iconName ? (
          <MaterialCommunityIcons
            name={iconName}
            size={18}
            color={COLORS.textMuted}
            style={{ marginLeft: spacing.md }}
          />
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={COLORS.textMuted}
          style={[s.input, !iconName && { paddingLeft: spacing.md }, style]}
          {...rest}
        />
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: COLORS.text,
    marginBottom: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: COLORS.text,
    padding: spacing.md,
  },
});
```

- [ ] **Step 7.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/LabeledInput.tsx
git commit -m "feat(ui): add LabeledInput primitive

Verbatim port from upande-quality. Label-above + framed TextInput with
optional MaterialCommunityIcons adornment (kept on MCI for backwards
compatibility with feature screens that pass MCI names).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Segmented primitive

**Files:**
- Create: `src/core/ui/Segmented.tsx`

- [ ] **Step 8.1: Create `src/core/ui/Segmented.tsx`**

```typescript
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (next: T) => void;
}

/** Pill-shaped segmented control with a spring-animated indicator pill. */
export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = useMemo(
    () => Math.max(0, options.findIndex((o) => o.value === value)),
    [value, options],
  );

  const padding = 4;
  const innerWidth = Math.max(0, containerWidth - padding * 2);
  const segmentWidth = options.length > 0 ? innerWidth / options.length : 0;
  const anim = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: activeIndex,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [activeIndex, anim]);

  const onLayout = (e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width);

  return (
    <View style={s.container} onLayout={onLayout}>
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            s.indicator,
            {
              width: segmentWidth,
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: options.map((_, i) => i),
                    outputRange: options.map((_, i) => i * segmentWidth),
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
            style={s.btn}
          >
            <Text style={[s.label, active && s.labelActive]} numberOfLines={1}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: borderRadius.full,
    padding: 4,
    marginBottom: spacing.md,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    zIndex: 1,
  },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.textMuted },
  labelActive: { fontFamily: fontFamily.semiBold, color: COLORS.text },
});
```

- [ ] **Step 8.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/Segmented.tsx
git commit -m "feat(ui): add Segmented primitive

Verbatim port from upande-quality. Pill-shaped segmented control with
spring-animated indicator and generic type parameter on values.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: DecisionChip primitive

**Files:**
- Create: `src/core/ui/DecisionChip.tsx`

- [ ] **Step 9.1: Create `src/core/ui/DecisionChip.tsx`**

```typescript
import { Pressable, StyleSheet, Text } from 'react-native';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

export function DecisionChip({ label, selected, disabled, onPress }: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        s.chip,
        selected ? s.chipSelected : null,
        disabled ? s.chipDisabled : null,
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      <Text style={[s.label, selected ? s.labelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 44,
  },
  chipSelected: { borderColor: COLORS.text, backgroundColor: COLORS.text },
  chipDisabled: { opacity: 0.4 },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.textMuted },
  labelSelected: { fontFamily: fontFamily.semiBold, color: COLORS.textOnPrimary },
});
```

- [ ] **Step 9.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/DecisionChip.tsx
git commit -m "feat(ui): add DecisionChip primitive

Verbatim port from upande-quality. Selectable pill — outline by default,
filled when selected, faded when disabled.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: FAB primitive

**Files:**
- Create: `src/core/ui/FAB.tsx`

- [ ] **Step 10.1: Create `src/core/ui/FAB.tsx`**

```typescript
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, shadow } from '@/src/core/theme';

interface FABProps {
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  visible?: boolean;
  /** When true, morph into a top-right × close affordance. */
  expanded?: boolean;
  color?: string;
  style?: ViewStyle;
  /** Optional Y for the expanded "close" position. Defaults to ~12% from top. */
  expandedTopY?: number | null;
}

const FAB_SIZE = 56;

/** Floating action button — 56×56 round, anchored bottom-right. When expanded
 *  it morphs into the top-right close button of an open sheet (translate +
 *  rotate 45° + scale + white surface fade). */
export function FAB({
  icon = 'add',
  onPress,
  visible = true,
  expanded = false,
  color,
  style,
  expandedTopY,
}: FABProps) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: 380,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [expanded, progress]);

  if (!visible) return null;

  const bottom = insets.bottom + 8;
  const screenH = Dimensions.get('window').height;
  const fallbackTop = Math.max(insets.top + 16, screenH * 0.12);
  const cornerTop = (expandedTopY ?? fallbackTop) + 12;
  const restingTop = screenH - bottom - FAB_SIZE;
  const translateYDelta = cornerTop - restingTop;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, translateYDelta],
  });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });
  const scale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.92, 0.8],
  });
  const surfaceOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const iconColor = expanded ? COLORS.text : COLORS.textOnPrimary;

  return (
    <Animated.View
      style={[
        s.fab,
        {
          backgroundColor: color ?? COLORS.primary,
          bottom,
          transform: [{ translateY }, { rotate }, { scale }],
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, s.surfaceLayer, { opacity: surfaceOpacity }]}
      />
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.touch}>
        <Ionicons name={icon} size={26} color={iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
    zIndex: 1000,
    elevation: 12,
  },
  surfaceLayer: {
    backgroundColor: COLORS.surface,
    borderRadius: FAB_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  touch: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: FAB_SIZE / 2,
  },
});
```

- [ ] **Step 10.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/FAB.tsx
git commit -m "feat(ui): add FAB primitive

Verbatim port from upande-quality. 56x56 floating action button anchored
bottom-right with an expanded morph to top-right close affordance.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: AnimatedTabIcon primitive

**Files:**
- Create: `src/core/ui/AnimatedTabIcon.tsx`

- [ ] **Step 11.1: Create `src/core/ui/AnimatedTabIcon.tsx`**

```typescript
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/core/theme';

interface Props {
  outline: keyof typeof Ionicons.glyphMap;
  filled: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  size: number;
}

/** Tab icon that springs up to ~1.2× on focus with an ease-in-out curve, plus
 *  a subtle vertical lift. Runs on the native driver for smoothness. */
export function AnimatedTabIcon({ outline, filled, focused, size }: Props) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: focused ? 1 : 0,
      duration: 360,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  const transform = [
    {
      scale: scale.interpolate({
        inputRange: [0, 0.65, 1],
        outputRange: [1, 1.28, 1.2],
      }),
    },
    { translateY: scale.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
  ];
  const opacity = scale.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <Animated.View style={{ transform, opacity }}>
      <Ionicons
        name={focused ? filled : outline}
        size={size}
        color={focused ? COLORS.text : COLORS.textMuted}
      />
    </Animated.View>
  );
}
```

- [ ] **Step 11.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/AnimatedTabIcon.tsx
git commit -m "feat(ui): add AnimatedTabIcon primitive

Verbatim port from upande-quality. Tab icon that springs to 1.2x on
focus with a slight vertical lift. Native driver for smoothness.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: OfflineBanner primitive

**Files:**
- Create: `src/core/ui/OfflineBanner.tsx`

- [ ] **Step 12.1: Create `src/core/ui/OfflineBanner.tsx`**

```typescript
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';
import { useNetworkStore } from '@/src/core/network/store';

/** Sticky banner shown at the top of every screen when offline. */
export function OfflineBanner() {
  const online = useNetworkStore((s) => s.online);
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: online ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [online, anim]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.wrap,
        {
          paddingTop: insets.top + 4,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-(insets.top + 56), 0],
              }),
            },
          ],
          opacity: anim,
        },
      ]}
    >
      <View style={s.banner}>
        <Ionicons name="cloud-offline-outline" size={16} color={COLORS.textOnPrimary} />
        <Text style={s.text} numberOfLines={1}>
          You&apos;re offline — check your network connection
        </Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5000,
    elevation: 16,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    maxWidth: '90%',
  },
  text: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: COLORS.textOnPrimary,
    flexShrink: 1,
  },
});
```

- [ ] **Step 12.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/OfflineBanner.tsx
git commit -m "feat(ui): add OfflineBanner primitive

Verbatim port from upande-quality. Sticky pill at the top of the screen
that animates in when useNetworkStore reports offline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Dropdown primitive

**Files:**
- Create: `src/core/ui/Dropdown.tsx`

- [ ] **Step 13.1: Create `src/core/ui/Dropdown.tsx`**

```typescript
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Option = { label: string; value: string; sublabel?: string };

type Props = {
  label: string;
  value: string | null;
  options: Option[];
  placeholder?: string;
  /** MCI glyph name — kept on MaterialCommunityIcons for backwards-compat. */
  iconName?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  searchable?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function Dropdown({
  label,
  value,
  options,
  placeholder,
  iconName,
  searchable = true,
  disabled,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, search, searchable]);

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[s.field, disabled && s.fieldDisabled]}
      >
        {iconName ? (
          <MaterialCommunityIcons
            name={iconName}
            size={18}
            color={COLORS.textMuted}
            style={{ marginLeft: spacing.md }}
          />
        ) : null}
        <Text
          style={[s.value, !selected && s.placeholder, !iconName && { paddingLeft: spacing.md }]}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder ?? 'Select…'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} style={{ marginRight: spacing.md }} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { paddingBottom: insets.bottom }]}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{label || 'Select'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={s.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {searchable ? (
              <View style={s.searchWrap}>
                <Ionicons name="search" size={16} color={COLORS.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search…"
                  placeholderTextColor={COLORS.textMuted}
                  style={s.search}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ) : null}

            <FlatList
              data={filtered}
              keyExtractor={(it) => it.value}
              ItemSeparatorComponent={() => <View style={s.sep} />}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onChange(item.value);
                      setSearch('');
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                    style={s.row}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowText, isSelected && { fontFamily: fontFamily.semiBold }]}>
                        {item.label}
                      </Text>
                      {item.sublabel ? <Text style={s.rowSub}>{item.sublabel}</Text> : null}
                    </View>
                    {isSelected ? <Ionicons name="checkmark" size={18} color={COLORS.text} /> : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyText}>No matches.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: COLORS.text,
    marginBottom: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48,
  },
  fieldDisabled: { opacity: 0.55 },
  value: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: COLORS.text,
    paddingVertical: spacing.md,
  },
  placeholder: { color: COLORS.textMuted },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sheetTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: COLORS.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  search: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.md, color: COLORS.text, padding: 0 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  rowText: { fontFamily: fontFamily.regular, fontSize: fontSize.md, color: COLORS.text },
  rowSub: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  empty: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textMuted },
});
```

- [ ] **Step 13.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/Dropdown.tsx
git commit -m "feat(ui): add Dropdown primitive

Verbatim port from upande-quality. Bottom-sheet picker with optional
search and sublabel-aware rows. MaterialCommunityIcons adornment for
backwards-compat with screens that pass MCI names.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Toast + ToastProvider

**Files:**
- Create: `src/core/ui/Toast.tsx`

- [ ] **Step 14.1: Create `src/core/ui/Toast.tsx`**

```typescript
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';
import { audio } from '@/src/core/audio';

type ToastKind = 'success' | 'error' | 'info';

type ToastState = { kind: ToastKind; message: string } | null;

type ToastContextValue = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const present = useCallback((next: ToastState) => {
    if (timer.current) clearTimeout(timer.current);
    setState(next);
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const ms = next?.kind === 'error' ? 5000 : 2600;
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setState(null);
      });
    }, ms);
  }, [anim]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value: ToastContextValue = {
    showSuccess: (message) => { audio.submit(); present({ kind: 'success', message }); },
    showError:   (message) => { audio.error();  present({ kind: 'error',   message }); },
    showInfo:    (message) => { present({ kind: 'info', message }); },
  };

  const iconName: keyof typeof Ionicons.glyphMap =
    state?.kind === 'success' ? 'checkmark-circle' :
    state?.kind === 'error'   ? 'alert-circle' :
                                'information-circle';
  const tint =
    state?.kind === 'success' ? COLORS.success :
    state?.kind === 'error'   ? COLORS.danger :
                                COLORS.primary;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {state ? (
        <SafeAreaView pointerEvents="none" style={styles.wrap} edges={['top']}>
          <Animated.View
            style={[
              styles.toast,
              {
                opacity: anim,
                transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
              },
            ]}
          >
            <Ionicons name={iconName} size={18} color={tint} />
            <Text style={styles.text} numberOfLines={4}>{state.message}</Text>
          </Animated.View>
        </SafeAreaView>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 9999 },
  toast: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    maxWidth: '90%',
  },
  text: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text, flexShrink: 1 },
});
```

- [ ] **Step 14.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/Toast.tsx
git commit -m "feat(ui): add Toast + ToastProvider

Verbatim port from upande-quality. Context-provider-style toast with
animated pill at top, three kinds (success/error/info), 2.6 s default
or 5 s for errors. Plays submit/error sounds via src/core/audio.
Existing react-native-toast-message usage stays untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: DrawerItem + DrawerItemsProvider

**Files:**
- Create: `src/core/ui/drawer-items-context.tsx`

This is adapted from upande-quality — the `DrawerItem` type is declared locally with a generic `route: string` and a required `icon` field (per upande-security spec). No tenant types.

- [ ] **Step 15.1: Create `src/core/ui/drawer-items-context.tsx`**

```typescript
import { createContext, useContext, type ReactNode } from 'react';
import type { Ionicons } from '@expo/vector-icons';

/** A single navigation row rendered inside the SideMenu. */
export type DrawerItem = {
  /** Display label. */
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

- [ ] **Step 15.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -3
git add src/core/ui/drawer-items-context.tsx
git commit -m "feat(ui): add DrawerItem type + DrawerItemsProvider

Adapted from upande-quality — DrawerItem is defined locally with a
generic 'string' route and a required per-item Ionicons name. No
tenant dependency. Wave 3 will provide items via this provider at
the app root, and SideMenu (next commit) consumes them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: SideMenu primitive (adapted)

**Files:**
- Create: `src/core/ui/SideMenu.tsx`

This is an adapted port — five upande-security-specific changes vs the upande-quality original:

1. No `useTenant()` import. Read `instanceUrl` from `useAuthStore`.
2. No `ROUTE_ICONS` lookup. Use `item.icon` directly.
3. User info from `useAuthStore.user?.email`. No `fullName` field — derive initials and header text from the email.
4. No "Configure station" footer row.
5. Brand text → `"Upande Security v{APP_VERSION}"`.

- [ ] **Step 16.1: Create `src/core/ui/SideMenu.tsx`**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/auth/store';
import { storage, StorageKeys } from '@/src/core/storage';
import { useDrawerItems } from './drawer-items-context';
import { APP_VERSION } from '@/src/core/version';

export function SideMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const logout = useAuthStore((s) => s.logout);
  const storeUser = useAuthStore((s) => s.user);
  const instanceUrl = useAuthStore((s) => s.instanceUrl);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const drawerWidth = Math.min(Math.max(screenWidth * 0.8, 240), 320);
  const slide = useRef(new Animated.Value(-drawerWidth)).current;

  const [email, setEmail] = useState(storeUser?.email ?? '');

  useEffect(() => {
    if (!visible) return;
    // Fallback to AsyncStorage when the auth store hasn't been populated yet
    // (e.g. legacy paths that mount SideMenu before hydrate finishes).
    if (!storeUser?.email) {
      storage.get(StorageKeys.emailBackup).then((e) => { if (e) setEmail(e); });
    } else {
      setEmail(storeUser.email);
    }
  }, [visible, storeUser?.email]);

  useEffect(() => {
    if (visible) {
      slide.setValue(-drawerWidth);
      Animated.timing(slide, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    } else {
      slide.setValue(-drawerWidth);
    }
  }, [visible, drawerWidth, slide]);

  const closeWithAnim = () => {
    Animated.timing(slide, { toValue: -drawerWidth, duration: 200, useNativeDriver: true })
      .start(() => onClose());
  };

  const items = useDrawerItems();

  const go = (route: string) => {
    closeWithAnim();
    setTimeout(() => router.replace(`/${route}` as never), 220);
  };

  const onSettings = () => {
    closeWithAnim();
    setTimeout(() => router.push('/settings' as never), 220);
  };

  const onLogout = async () => {
    closeWithAnim();
    setTimeout(async () => {
      await logout();
      router.replace('/login');
    }, 220);
  };

  // Initials derive from the email: first letter of local part + first letter
  // after the first dot or separator (e.g. "judah@upande.com" → "J", or
  // "first.last@x" → "FL"). Falls back to a single uppercase letter.
  const initials = (() => {
    if (!email) return '?';
    const local = email.split('@')[0] ?? '';
    const parts = local.split(/[.\-_]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0]?.[0] ?? email[0] ?? '?').toUpperCase();
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeWithAnim}
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
    >
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={closeWithAnim} />
        <Animated.View
          style={[
            s.drawer,
            { width: drawerWidth, transform: [{ translateX: slide }] },
          ]}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'bottom']}>
            <ScrollView
              contentContainerStyle={[s.scroll, { paddingTop: insets.top > 0 ? spacing.md : spacing.lg }]}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View style={s.header}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials}</Text>
                </View>
                <Text style={s.name} numberOfLines={1}>
                  {email || 'User'}
                </Text>
                {instanceUrl ? (
                  <Text style={s.meta} numberOfLines={1}>
                    {instanceUrl.replace(/^https?:\/\//, '')}
                  </Text>
                ) : null}
              </View>

              <View style={s.nav}>
                {items.length === 0 ? (
                  <Text style={s.empty}>No screens configured.</Text>
                ) : (
                  items.map((item) => (
                    <Pressable
                      key={item.route}
                      style={({ pressed }) => [s.navItem, pressed && s.navItemPressed]}
                      onPress={() => go(item.route)}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                      <Text style={s.navLabel}>{item.label}</Text>
                    </Pressable>
                  ))
                )}
              </View>

              <View style={s.footer}>
                <Pressable style={s.footerRow} onPress={onSettings} hitSlop={4}>
                  <View style={[s.badge, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="cog-outline" size={15} color="#6366F1" />
                  </View>
                  <Text style={s.footerText}>Settings</Text>
                </Pressable>
                <Pressable style={s.footerRow} onPress={onLogout} hitSlop={4}>
                  <View style={[s.badge, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="log-out-outline" size={15} color={COLORS.danger} />
                  </View>
                  <Text style={[s.footerText, { color: COLORS.danger }]}>Sign Out</Text>
                </Pressable>
                <Text style={s.version}>Upande Security v{APP_VERSION}</Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.surface,
    elevation: 24,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg },
  header: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: COLORS.textOnPrimary },
  name: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text },
  meta: { fontFamily: fontFamily.regular, fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

  nav: { paddingTop: spacing.xs, paddingBottom: spacing.sm },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  navItemPressed: { backgroundColor: COLORS.surfaceAlt },
  navLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text },
  empty: { paddingHorizontal: spacing.sm, fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textMuted },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  footerText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text, flex: 1 },
  version: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
```

- [ ] **Step 16.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -5
git add src/core/ui/SideMenu.tsx
git commit -m "feat(ui): add SideMenu (adapted for upande-security)

Adapted from upande-quality. Five upande-security-specific changes:
no useTenant import (instanceUrl read from authStore); per-item icon
field (drops the upande-quality ROUTE_ICONS lookup); email-only
header derived from authStore.user; no 'Configure station' footer
row; brand text becomes 'Upande Security v{APP_VERSION}'. Layout,
animation, accessibility and Sign Out flow unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Screen primitive

**Files:**
- Create: `src/core/ui/Screen.tsx`

This is verbatim from upande-quality. It mounts SideMenu (Task 16) and Button (Task 2). Both must already exist before this commit.

- [ ] **Step 17.1: Create `src/core/ui/Screen.tsx`**

```typescript
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';
import { Button } from './Button';
import { SideMenu } from './SideMenu';

type Props = {
  title?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => Promise<void> | void;
  hideMenu?: boolean;
  /** When false, the body is rendered as a flex View (no scroll). Default true. */
  scroll?: boolean;
  contentPadded?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

export function Screen({
  title,
  loading,
  error,
  onRetry,
  onRefresh,
  hideMenu,
  scroll = true,
  contentPadded = true,
  children,
  footer,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleRefresh = onRefresh
    ? async () => {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    : undefined;

  const padding = contentPadded ? s.content : { padding: 0 };

  let body: ReactNode;
  if (loading) {
    body = (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.text} />
      </View>
    );
  } else if (error) {
    body = (
      <View style={s.center}>
        <Text style={s.errorTitle}>Something went wrong</Text>
        <Text style={s.errorMsg}>{error}</Text>
        {onRetry ? (
          <Button label="Retry" onPress={onRetry} style={{ marginTop: 16, alignSelf: 'stretch' }} />
        ) : null}
      </View>
    );
  } else if (scroll) {
    body = (
      <ScrollView
        contentContainerStyle={[s.content, padding]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          handleRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.text}
              colors={[COLORS.text]}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    );
  } else {
    body = <View style={[s.flex, padding]}>{children}</View>;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {title ? (
        <View style={s.header}>
          {!hideMenu ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              hitSlop={10}
              style={s.menuBtn}
              accessibilityLabel="Open menu"
            >
              <Ionicons name="menu-outline" size={24} color={COLORS.text} />
            </Pressable>
          ) : (
            <View style={s.menuBtn} />
          )}
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {/* Symmetric spacer keeps the title centred */}
          <View style={s.menuBtn} />
        </View>
      ) : null}
      {!hideMenu ? <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} /> : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.flex}
      >
        {body}
      </KeyboardAvoidingView>
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgMuted },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  menuBtn: { width: 32, alignItems: 'center', justifyContent: 'center', padding: 4 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: COLORS.text,
  },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  errorTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.danger },
  errorMsg: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textMuted, textAlign: 'center' },
  footer: {
    padding: spacing.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
});
```

- [ ] **Step 17.2: Type-check and commit**

```bash
cd /home/jk/Projects/upande-security
npx tsc --noEmit 2>&1 | tail -5
git add src/core/ui/Screen.tsx
git commit -m "feat(ui): add Screen primitive

Verbatim port from upande-quality. Header with hamburger that opens
SideMenu, scrollable body with optional refresh + loading + error
fallback, and an optional sticky footer. Depends on Button (retry)
and SideMenu (drawer). KeyboardAvoidingView wraps the body.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Post-flight

Verify the whole wave bundles cleanly and didn't sneak in any unintended changes.

- [ ] **Step 18.1: Type-check everything**

```bash
cd /home/jk/Projects/upande-security && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 18.2: Confirm Metro builds**

```bash
cd /home/jk/Projects/upande-security && npx expo export --platform ios --output-dir /tmp/wave2-final 2>&1 | tail -10
```

Expected: bundle completes. Note: the new primitives are not imported anywhere yet (they will be in Wave 3), so tree-shaking keeps them out of the bundle — the bundle size should be essentially unchanged from the post-Wave-1 baseline.

Clean up:
```bash
rm -rf /tmp/wave2-final
```

- [ ] **Step 18.3: Confirm scope discipline — no existing files touched**

```bash
cd /home/jk/Projects/upande-security && git log --name-only 627df8f..HEAD | grep -E "^(app|components|lib|frappe)/" | head
```

Expected: empty output. No file under `app/`, `components/`, `lib/`, or `frappe/` should appear in any Wave 2 commit. If any does, STOP and surface it.

- [ ] **Step 18.4: Confirm pre-existing uncommitted changes untouched**

```bash
cd /home/jk/Projects/upande-security && git status --short
```

Expected to see exactly:
```
 M app/(app)/(tabs)/gate/_layout.tsx
 M app/(app)/(tabs)/gate/pending.tsx
 M frappe/scripts/_sync_json.py
 M frappe/server_scripts.json
 M lib/services/api.ts
?? frappe/scripts/gate_activity.py
?? lib/hooks/useGateActivity.ts
```

If anything else appears, investigate before claiming Wave 2 done.

- [ ] **Step 18.5: Confirm commit count + paths**

```bash
cd /home/jk/Projects/upande-security && git log --oneline 627df8f..HEAD
```

Expected: 17 commits, one per file added, no merges.

---

## Wave 2 done

17 atomic commits land the canonical UI primitives + audio module. The app is visually unchanged today; Waves 3 and 4 consume the new primitives.

Files added (17):
- `src/core/audio/index.ts`
- `src/core/ui/AnimatedTabIcon.tsx`
- `src/core/ui/Button.tsx`
- `src/core/ui/Card.tsx` (exports both `Card` and `Alert`)
- `src/core/ui/DecisionChip.tsx`
- `src/core/ui/Dropdown.tsx`
- `src/core/ui/FAB.tsx`
- `src/core/ui/Input.tsx`
- `src/core/ui/LabeledInput.tsx`
- `src/core/ui/OfflineBanner.tsx`
- `src/core/ui/ProgressBar.tsx`
- `src/core/ui/Screen.tsx`
- `src/core/ui/Segmented.tsx`
- `src/core/ui/SideMenu.tsx` (adapted)
- `src/core/ui/Spinner.tsx`
- `src/core/ui/Toast.tsx`
- `src/core/ui/drawer-items-context.tsx` (adapted)

Wave 3 will mount the new primitives in canonical chrome (login, biometric-lock, settings) and wire the drawer; Wave 4 will sweep the existing feature screens to use the new primitives + Ionicons + theme tokens.
