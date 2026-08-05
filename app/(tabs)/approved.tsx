import { useState } from 'react';
import { View, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { useApprovedAppointments } from '@/lib/hooks/useApprovedAppointments';
import { useCheckIn } from '@/lib/hooks/useCheckIn';
import { useCheckOut } from '@/lib/hooks/useCheckOut';
import { fmtDateTime } from '@/lib/utils/date';
import type { ApprovedAppointmentRow } from '@/lib/services/api';
import { COLORS, fontFamily, fontSize, spacing, borderRadius } from '@/src/core/theme';
import { Button } from '@/src/core/ui/Button';
import { IssueVisitorBadge } from '@/components/gate/IssueVisitorBadge';

type Status = 'Approved by Host' | 'Visitor Checked In' | string;

function statusStyle(state: Status) {
  if (state === 'Visitor Checked In') {
    return {
      accent: '#1E88E5',
      tint: 'rgba(30,136,229,0.10)',
      label: 'Inside',
      icon: 'log-in-outline' as keyof typeof Ionicons.glyphMap,
    };
  }
  return {
    accent: '#43A047',
    tint: 'rgba(67,160,71,0.10)',
    label: 'Approved',
    icon: 'checkmark-circle-outline' as keyof typeof Ionicons.glyphMap,
  };
}

function ApprovedCard({
  item,
  onAction,
  busy,
}: {
  item: ApprovedAppointmentRow;
  onAction: (item: ApprovedAppointmentRow) => void;
  busy: boolean;
}) {
  const ss = statusStyle(item.workflow_state);
  const isCheckedIn = item.workflow_state === 'Visitor Checked In';
  const actionLabel = isCheckedIn ? 'CHECK OUT' : 'CHECK IN';
  const actionIcon: keyof typeof Ionicons.glyphMap = isCheckedIn ? 'log-out-outline' : 'log-in-outline';
  const actionColor = isCheckedIn ? COLORS.danger : COLORS.success;
  // Same client-side gate as the Gate tab: a visitor badge must be issued
  // before check-in — this screen has its own independent CHECK IN button,
  // so it needs the same enforcement or it's a bypass of the Gate tab's gate.
  const hasBadge = Boolean(item.custom_visitor_badge_number);
  const checkInBlocked = !isCheckedIn && !hasBadge;

  return (
    <View style={s.card}>
      <View style={s.cardPadding}>
        <View style={s.cardHeaderRow}>
          <Ionicons name={ss.icon} size={16} color={ss.accent} />
          <Text style={s.cardName} numberOfLines={1}>
            {item.customer_name}
          </Text>
          <View style={[s.stateBadge, { backgroundColor: ss.tint, borderColor: ss.accent }]}>
            <Text style={[s.stateBadgeText, { color: ss.accent }]}>{ss.label}</Text>
          </View>
        </View>

        <View style={s.detailRows}>
          <View style={s.detailRow}>
            <Ionicons name="person-outline" size={13} color={COLORS.textMuted} />
            <Text style={s.detailText}>
              Visiting:{' '}
              <Text style={s.detailBold}>{item.host_name || item.host_id}</Text>
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
          {isCheckedIn && item.check_in_time ? (
            <View style={s.detailRow}>
              <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
              <Text style={[s.detailText, { color: COLORS.textMuted }]}>
                In: {fmtDateTime(item.check_in_time)}
              </Text>
            </View>
          ) : item.scheduled_time ? (
            <View style={s.detailRow}>
              <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
              <Text style={[s.detailText, { color: COLORS.textMuted }]}>
                Scheduled: {fmtDateTime(item.scheduled_time)}
              </Text>
            </View>
          ) : null}
          {item.transport || item.plate ? (
            <View style={s.detailRow}>
              <Ionicons
                name={item.transport === 'On Foot' ? 'walk-outline' : 'car-outline'}
                size={13}
                color={COLORS.textMuted}
              />
              <Text style={[s.detailText, { color: COLORS.textMuted }]}>
                {[item.transport, item.plate, item.colour].filter(Boolean).join(' · ')}
                {item.passengers > 0 ? ` · +${item.passengers}` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        {!isCheckedIn ? (
          <IssueVisitorBadge
            appointmentName={item.name}
            currentBadge={item.custom_visitor_badge_number ?? undefined}
            hostReceivedAt={item.custom_host_received_time}
          />
        ) : null}

        <Button
          label={checkInBlocked ? 'ISSUE BADGE TO CHECK IN' : actionLabel}
          onPress={() => onAction(item)}
          disabled={busy || checkInBlocked}
          loading={busy}
          variant={isCheckedIn ? 'outline' : 'primary'}
          color={checkInBlocked ? COLORS.textMuted : actionColor}
          iconLeft={checkInBlocked ? 'qr-code-outline' : actionIcon}
          style={s.actionBtn}
        />
      </View>
    </View>
  );
}

export default function ApprovedTab() {
  const { data, isFetching, isLoading, error, refetch } = useApprovedAppointments();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const [activeName, setActiveName] = useState<string | null>(null);

  const items = data ?? [];
  const inside = items.filter((i) => i.workflow_state === 'Visitor Checked In').length;
  const approved = items.length - inside;

  const onAction = (item: ApprovedAppointmentRow) => {
    if (checkIn.isPending || checkOut.isPending) return;
    if (item.workflow_state === 'Visitor Checked In') {
      Alert.alert('Check out?', `Check out ${item.customer_name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check out',
          style: 'destructive',
          onPress: async () => {
            setActiveName(item.name);
            try {
              await checkOut.mutateAsync(item.name);
            } finally {
              setActiveName(null);
            }
          },
        },
      ]);
    } else {
      Alert.alert('Check in?', `Check in ${item.customer_name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check in',
          onPress: async () => {
            setActiveName(item.name);
            try {
              await checkIn.mutateAsync({ name: item.name });
            } finally {
              setActiveName(null);
            }
          },
        },
      ]);
    }
  };

  return (
    <Screen
      title="Approved"
      onRefresh={async () => {
        await refetch();
      }}
    >
      <View style={s.pageHeaderRow}>
        <Text style={s.pageTitle}>Approved Visitors</Text>
        {isLoading || isFetching ? (
          <ActivityIndicator size="small" color={COLORS.textMuted} />
        ) : null}
      </View>

      {!isLoading && items.length > 0 ? (
        <View style={s.summaryRow}>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>READY TO ENTER</Text>
            <Text style={[s.summaryValue, { color: '#43A047' }]}>{approved}</Text>
          </View>
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>INSIDE NOW</Text>
            <Text style={[s.summaryValue, { color: '#1E88E5' }]}>{inside}</Text>
          </View>
        </View>
      ) : null}

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
          <Ionicons name="calendar-outline" size={56} color={COLORS.border} />
          <Text style={s.emptyTitle}>No approved visitors</Text>
          <Text style={s.emptySubtitle}>Pull down to refresh</Text>
        </View>
      ) : null}

      {items.map((item) => (
        <ApprovedCard
          key={item.name}
          item={item}
          onAction={onAction}
          busy={activeName === item.name && (checkIn.isPending || checkOut.isPending)}
        />
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.bgMuted },
  content: { padding: spacing.md, paddingBottom: 40 },
  pageHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  pageTitle: { flex: 1, fontSize: fontSize.md, fontFamily: fontFamily.bold, color: COLORS.text },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  summaryBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.sm,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    fontFamily: fontFamily.semiBold,
  },
  summaryValue: { fontSize: 20, fontFamily: fontFamily.bold, marginTop: 2 },
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
  actionBtn: { marginTop: spacing.md },
  errorBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
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
