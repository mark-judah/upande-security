import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Card } from '@/src/core/ui/Card';
import { useAuthStore } from '@/src/core/auth/store';
import { useSessionInfo } from '@/lib/hooks/useSessionInfo';
import { useDailySummary } from '@/lib/hooks/useDailySummary';
import { useIncidents } from '@/lib/hooks/useIncidents';
import { useMyShift } from '@/lib/hooks/useMyShift';
import { useUnreadMessages } from '@/lib/hooks/useMessages';
import { fmtDateTime } from '@/lib/utils/date';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

type IconName = keyof typeof Ionicons.glyphMap;

// Home is the at-a-glance screen: who is signed in and their shift, today's
// gate numbers, open incidents, and the few things done most. The full list
// of screens is the side menu and the bottom tabs, so it is not repeated
// here.

const OPEN_STATUSES = ['Open', 'In Progress'];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Stat({
  label,
  value,
  icon,
  color,
  onPress,
}: {
  label: string;
  value: number | undefined;
  icon: IconName;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.stat, pressed && onPress ? { opacity: 0.7 } : null]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[s.statValue, { color }]}>{value ?? '–'}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Pressable>
  );
}

function Action({ label, icon, route, badge }: { label: string; icon: IconName; route: string; badge?: number }) {
  return (
    <Pressable
      onPress={() => router.push(route as never)}
      style={({ pressed }) => [s.action, pressed && { opacity: 0.7 }]}
    >
      <View style={s.actionIcon}>
        <Ionicons name={icon} size={22} color={COLORS.text} />
        {badge ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const email = useAuthStore((st) => st.user?.email ?? null);
  const session = useSessionInfo();
  const shift = useMyShift();
  const today = useMemo(() => new Date(), []);
  const summary = useDailySummary(today);
  // Open incidents from the last 30 days - the same list the Incidents
  // screen shows for "Last 30 days", scoped server-side to what this user
  // may see.
  const incidentRange = useMemo(() => {
    const from = new Date(today);
    from.setDate(today.getDate() - 29);
    return { from: isoDate(from), to: isoDate(today) };
  }, [today]);
  const incidents = useIncidents(incidentRange);
  const openIncidents = incidents.data?.filter((i) => OPEN_STATUSES.includes(i.status || 'Open')).length;

  const unread = useUnreadMessages().data?.unread ?? 0;
  const name = session.data?.full_name || email || 'Security user';
  const sh = shift.data;

  return (
    <Screen
      title="Upande Security"
      onRefresh={async () => {
        await Promise.all([summary.refetch(), incidents.refetch(), shift.refetch()]);
      }}
    >
      <Card>
        <Text style={s.greeting}>Welcome,</Text>
        <Text style={s.name}>{name}</Text>
        {sh ? (
          <View style={s.shiftRow}>
            <Ionicons
              name={sh.status === 'Active' ? 'time' : 'time-outline'}
              size={14}
              color={sh.status === 'Active' ? COLORS.success : COLORS.textMuted}
            />
            <Text style={s.shiftText} numberOfLines={2}>
              {sh.status === 'Active' ? 'On shift now' : 'Next shift'} · {sh.shift_type} shift · {sh.farm}
              {sh.status === 'Active' ? '' : ` · ${fmtDateTime(sh.start_date)}`}
            </Text>
          </View>
        ) : shift.isLoading ? null : (
          <Text style={s.shiftText}>No shift on the roster for you today</Text>
        )}
      </Card>

      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>Today at the gate</Text>
        {summary.isFetching ? <ActivityIndicator size="small" color={COLORS.textMuted} /> : null}
      </View>
      <View style={s.statRow}>
        <Stat label="Checked in" value={summary.data?.total_checked_in} icon="log-in-outline" color={COLORS.text} />
        <Stat
          label="Still inside"
          value={summary.data?.still_inside}
          icon="people-outline"
          color="#1E88E5"
          onPress={() => router.push('/approved')}
        />
        <Stat label="Checked out" value={summary.data?.total_checked_out} icon="log-out-outline" color={COLORS.textMuted} />
      </View>
      <Pressable
        onPress={() => router.push('/incidents')}
        style={({ pressed }) => [s.incidentRow, pressed && { opacity: 0.7 }]}
      >
        <Ionicons
          name="warning-outline"
          size={20}
          color={openIncidents ? COLORS.danger : COLORS.textMuted}
        />
        <Text style={s.incidentText}>
          {openIncidents === undefined
            ? 'Incidents'
            : openIncidents === 0
              ? 'No open incidents in the last 30 days'
              : `${openIncidents} open incident${openIncidents === 1 ? '' : 's'} in the last 30 days`}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
      </Pressable>
      <Pressable
        onPress={() => router.push('/reports')}
        style={({ pressed }) => [s.reportsLink, pressed && { opacity: 0.7 }]}
      >
        <Text style={s.reportsLinkText}>Full reports</Text>
        <Ionicons name="arrow-forward" size={14} color={COLORS.textSecondary} />
      </Pressable>

      <Text style={[s.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>Quick actions</Text>
      <View style={s.actionRow}>
        <Action label="Gate" icon="log-in-outline" route="/gate" />
        <Action label="Report incident" icon="warning-outline" route="/incident-new" />
        <Action label="Patrol" icon="walk-outline" route="/patrol" />
        <Action label="Messages" icon="chatbubbles-outline" route="/messages" badge={unread} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  greeting: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textSecondary },
  name: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: COLORS.text, marginTop: 2 },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  shiftText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: spacing.xs,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingVertical: spacing.md,
    gap: 2,
  },
  statValue: { fontFamily: fontFamily.bold, fontSize: 22 },
  statLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: COLORS.textMuted },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  incidentText: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text },
  reportsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: spacing.sm,
    paddingVertical: 4,
  },
  reportsLinkText: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: COLORS.textSecondary },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#1E88E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontFamily: fontFamily.bold, fontSize: 10 },
  actionLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs, color: COLORS.text, textAlign: 'center' },
});
