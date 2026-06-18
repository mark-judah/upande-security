import { useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { useGateActivity } from '@/lib/hooks/useGateActivity';
import { fmtDateTime } from '@/lib/utils/date';
import type { GateActivityRow } from '@/lib/services/api';
import { COLORS, fontFamily, fontSize, spacing, borderRadius } from '@/src/core/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

type StateMeta = {
  label: string;
  color: string;
  tint: string;
  icon: IoniconName;
  group: 'awaiting' | 'updated' | 'blocked';
};

const STATE_META: Record<string, StateMeta> = {
  'Open': {
    label: 'Open',
    color: '#607D8B',
    tint: 'rgba(96,125,139,0.10)',
    icon: 'sparkles-outline',
    group: 'awaiting',
  },
  'Pending Secretary Review': {
    label: 'Awaiting Secretary',
    color: '#7C5CFC',
    tint: 'rgba(124,92,252,0.10)',
    icon: 'hourglass-outline',
    group: 'awaiting',
  },
  'Pending Host Review': {
    label: 'Awaiting Host',
    color: '#FB8C00',
    tint: 'rgba(251,140,0,0.10)',
    icon: 'hourglass-outline',
    group: 'awaiting',
  },
  'Approved by Secretary': {
    label: 'Approved by Secretary',
    color: '#43A047',
    tint: 'rgba(67,160,71,0.10)',
    icon: 'checkmark-circle-outline',
    group: 'awaiting',
  },
  'Rescheduled by Host': {
    label: 'Rescheduled by Host',
    color: '#1E88E5',
    tint: 'rgba(30,136,229,0.10)',
    icon: 'time-outline',
    group: 'updated',
  },
  'Rescheduled by Secretary': {
    label: 'Rescheduled by Secretary',
    color: '#1E88E5',
    tint: 'rgba(30,136,229,0.10)',
    icon: 'time-outline',
    group: 'updated',
  },
  'Redirected to Another Host': {
    label: 'Redirected',
    color: '#8E24AA',
    tint: 'rgba(142,36,170,0.10)',
    icon: 'git-branch-outline',
    group: 'updated',
  },
  'Rejected by Host': {
    label: 'Rejected by Host',
    color: COLORS.danger,
    tint: `rgba(239,68,68,0.10)`,
    icon: 'close-circle-outline',
    group: 'blocked',
  },
  'Rejected by Secretary': {
    label: 'Rejected by Secretary',
    color: COLORS.danger,
    tint: `rgba(239,68,68,0.10)`,
    icon: 'close-circle-outline',
    group: 'blocked',
  },
};

const DEFAULT_META: StateMeta = {
  label: 'Unknown',
  color: COLORS.textMuted,
  tint: 'rgba(0,0,0,0.06)',
  icon: 'help-circle-outline',
  group: 'awaiting',
};

function metaFor(state: string): StateMeta {
  return STATE_META[state] || DEFAULT_META;
}

function ActivityCard({ item }: { item: GateActivityRow }) {
  const m = metaFor(item.workflow_state);
  return (
    <View style={s.card}>
      <View style={s.cardPadding}>
        <View style={s.cardHeaderRow}>
          <Ionicons name={m.icon} size={16} color={m.color} />
          <Text style={s.cardName} numberOfLines={1}>
            {item.customer_name}
          </Text>
          <View style={[s.stateBadge, { backgroundColor: m.tint, borderColor: m.color }]}>
            <Text style={[s.stateBadgeText, { color: m.color }]}>{m.label}</Text>
          </View>
        </View>

        <View style={s.detailRows}>
          <View style={s.detailRow}>
            <Ionicons name="person-outline" size={13} color={COLORS.textMuted} />
            <Text style={s.detailText}>
              Visiting:{' '}
              <Text style={s.detailBold}>{item.host_name || item.host_id || '—'}</Text>
            </Text>
          </View>
          {item.phone ? (
            <View style={s.detailRow}>
              <Ionicons name="call-outline" size={13} color={COLORS.textMuted} />
              <Text style={s.detailText}>{item.phone}</Text>
            </View>
          ) : null}
          {item.purpose ? (
            <View style={[s.detailRow, { alignItems: 'flex-start' }]}>
              <Ionicons name="document-text-outline" size={13} color={COLORS.textMuted} style={{ marginTop: 1 }} />
              <Text style={[s.detailText, { flex: 1 }]} numberOfLines={2}>
                {item.purpose}
              </Text>
            </View>
          ) : null}
          {item.scheduled_time ? (
            <View style={s.detailRow}>
              <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
              <Text style={[s.detailText, { color: COLORS.textMuted }]}>
                Scheduled: {fmtDateTime(item.scheduled_time)}
              </Text>
            </View>
          ) : null}
        </View>

        {(item.reason || item.extra_label) ? (
          <View style={[s.extraBox, { backgroundColor: m.tint }]}>
            {item.extra_label && item.extra_value ? (
              <View style={[s.detailRow, { alignItems: 'flex-start' }]}>
                <Ionicons
                  name={item.extra_label === 'New time' ? 'calendar-outline' : 'swap-horizontal-outline'}
                  size={14}
                  color={m.color}
                  style={{ marginTop: 1 }}
                />
                <Text style={[s.extraText, { color: m.color }]}>
                  <Text style={s.extraBold}>{item.extra_label}:</Text>{' '}
                  {item.extra_label === 'New time'
                    ? fmtDateTime(item.extra_value)
                    : item.extra_value}
                </Text>
              </View>
            ) : null}
            {item.reason ? (
              <View style={[s.detailRow, { alignItems: 'flex-start' }]}>
                <Ionicons name="information-circle-outline" size={14} color={m.color} style={{ marginTop: 1 }} />
                <Text style={[s.extraText, { color: m.color }]}>
                  <Text style={s.extraBold}>Reason:</Text> {item.reason}
                </Text>
              </View>
            ) : null}
            {item.actor ? (
              <View style={s.detailRow}>
                <Ionicons name="id-card-outline" size={14} color={m.color} />
                <Text style={[s.extraText, { color: m.color, opacity: 0.85 }]}>
                  By {item.actor}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function GroupHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={s.groupHeader}>
      <Text style={s.groupTitle}>{title}</Text>
      <Text style={s.groupCount}>{count}</Text>
    </View>
  );
}

export default function VisitsTab() {
  const { data, isFetching, isLoading, error, refetch } = useGateActivity();
  const items = data ?? [];

  const groups = useMemo(() => {
    const awaiting: GateActivityRow[] = [];
    const updated: GateActivityRow[] = [];
    const blocked: GateActivityRow[] = [];
    for (const it of items) {
      const g = metaFor(it.workflow_state).group;
      if (g === 'awaiting') awaiting.push(it);
      else if (g === 'updated') updated.push(it);
      else blocked.push(it);
    }
    return { awaiting, updated, blocked };
  }, [items]);

  return (
    <Screen
      title="Visits"
      onRefresh={async () => {
        await refetch();
      }}
    >
      <View style={s.pageHeaderRow}>
        <Text style={s.pageTitle}>Recent Visit Activity</Text>
        {isLoading || isFetching ? <ActivityIndicator size="small" color={COLORS.textMuted} /> : null}
      </View>
      <Text style={s.pageSubtitle}>Last 7 days · auto-refreshes every 30s</Text>

      {error ? (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color="#E65100" />
          <Text style={s.errorText}>
            {error instanceof Error ? error.message : 'Failed to load'}
          </Text>
        </View>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={56} color={COLORS.border} />
          <Text style={s.emptyTitle}>No visit activity</Text>
          <Text style={s.emptySubtitle}>Pull down to refresh</Text>
        </View>
      ) : null}

      {groups.awaiting.length > 0 ? (
        <>
          <GroupHeader title="Awaiting action" count={groups.awaiting.length} />
          {groups.awaiting.map((item) => (
            <ActivityCard key={item.name} item={item} />
          ))}
        </>
      ) : null}

      {groups.updated.length > 0 ? (
        <>
          <GroupHeader title="Rescheduled / Redirected" count={groups.updated.length} />
          {groups.updated.map((item) => (
            <ActivityCard key={item.name} item={item} />
          ))}
        </>
      ) : null}

      {groups.blocked.length > 0 ? (
        <>
          <GroupHeader title="Rejected — do not admit" count={groups.blocked.length} />
          {groups.blocked.map((item) => (
            <ActivityCard key={item.name} item={item} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.bgMuted },
  content: { padding: spacing.md, paddingBottom: 40 },
  pageHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  pageTitle: { flex: 1, fontSize: fontSize.md, fontFamily: fontFamily.bold, color: COLORS.text },
  pageSubtitle: {
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    fontFamily: fontFamily.regular,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  cardPadding: { padding: 14 },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardName: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    color: COLORS.text,
    marginLeft: spacing.sm - 2,
  },
  stateBadge: {
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
  },
  stateBadgeText: { fontSize: fontSize.xs, fontFamily: fontFamily.semiBold },
  detailRows: { gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailText: {
    fontSize: fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: fontFamily.regular,
    marginLeft: 5,
  },
  detailBold: { fontFamily: fontFamily.semiBold },
  extraBox: {
    marginTop: 10,
    borderRadius: borderRadius.sm,
    padding: 10,
    gap: 4,
  },
  extraText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    marginLeft: spacing.sm - 2,
    flex: 1,
  },
  extraBold: { fontFamily: fontFamily.bold },
  groupHeader: {
    marginTop: 14,
    marginBottom: spacing.sm - 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupTitle: {
    flex: 1,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupCount: {
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    fontFamily: fontFamily.semiBold,
  },
  errorBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#E65100',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginLeft: spacing.sm,
    flex: 1,
  },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: {
    color: COLORS.textMuted,
    fontSize: fontSize.md,
    fontFamily: fontFamily.semiBold,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    color: COLORS.border,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: spacing.xs,
  },
});
