import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Card } from '@/src/core/ui/Card';
import { useAuthStore } from '@/src/core/auth/store';
import { useDrawerItems, type DrawerItem } from '@/src/core/ui/drawer-items-context';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

const ROUTE_HINTS: Record<string, string> = {
  gate:      'Check in visitors, contractors, staff and company vehicles',
  visits:    'Recent visit activity — pending, rescheduled, rejected',
  approved:  'Visitors approved by host — one-tap check-in and out',
  summary:   "Today's gate totals and full activity timeline",
  incidents: 'File a new incident or browse what you reported',
  patrol:    'Start a patrol or resume an active one',
};

export default function HomeScreen() {
  const email = useAuthStore((s) => s.user?.email ?? null);
  const items = useDrawerItems().filter((it) => it.route !== '');

  return (
    <Screen title="Upande Security">
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={s.greeting}>Welcome,</Text>
          <Text style={s.name}>{email ?? 'Security user'}</Text>
        </Card>

        <View style={s.grid}>
          {items.map((it: DrawerItem) => (
            <Pressable
              key={it.route}
              onPress={() => router.push(`/${it.route}` as never)}
              style={({ pressed }) => [s.tile, pressed && { opacity: 0.7 }]}
            >
              <View style={s.tileIcon}>
                <Ionicons name={it.icon} size={22} color={COLORS.text} />
              </View>
              <Text style={s.tileLabel}>{it.label}</Text>
              <Text style={s.tileHint} numberOfLines={2}>
                {ROUTE_HINTS[it.route] ?? ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  greeting: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textSecondary },
  name: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: COLORS.text, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  tile: {
    flexBasis: '48%',
    flexGrow: 0,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    gap: spacing.xs,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tileLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text },
  tileHint: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, lineHeight: 16 },
});
