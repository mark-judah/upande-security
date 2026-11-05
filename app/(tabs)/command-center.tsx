import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// Sub-screens are top-level Stack routes (app/command-center-*.tsx),
// pushed from here — this app doesn't nest routes under a tab folder
// anywhere else (e.g. Incidents pushes to /incident-new, Patrol to
// /patrol-active), so this landing screen follows that established
// convention rather than introducing app/(tabs)/command-center/*.tsx.
const ENTRIES: {
  key: string;
  route: '/command-center-shifts' | '/command-center-settings';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
}[] = [
  {
    key: 'shifts',
    route: '/command-center-shifts',
    icon: 'calendar-outline',
    title: 'Shift Planning',
    hint: 'Coverage board and guard assignments, by farm and shift',
  },
  {
    key: 'settings',
    route: '/command-center-settings',
    icon: 'settings-outline',
    title: 'Security Ops Settings',
    hint: 'Alert thresholds and the Command Center allowlist',
  },
];

// Incidents are reviewed on the Incidents screen itself (a Security Head
// taps a card); vehicle stickers and supplier badges are handled in Desk.
export default function CommandCenterScreen() {
  const entries = ENTRIES;
  return (
    <Screen title="Command Center">
      <Text style={s.intro}>
        Shift planning and security settings.
      </Text>

      {entries.map((entry) => (
        <Pressable
          key={entry.key}
          onPress={() => router.push(entry.route)}
          style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
        >
          <View style={s.rowIcon}>
            <Ionicons name={entry.icon} size={22} color={COLORS.text} />
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowTitle}>{entry.title}</Text>
            <Text style={s.rowHint} numberOfLines={2}>
              {entry.hint}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text },
  rowHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
