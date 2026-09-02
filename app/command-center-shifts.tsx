import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Card } from '@/src/core/ui/Card';
import { Segmented } from '@/src/core/ui/Segmented';
import { useShiftDashboard } from '@/lib/hooks/useShiftDashboard';
import type {
  ShiftDashboardSummary,
  ShiftPeriod,
  ShiftRow,
  ShiftStatus,
} from '@/lib/services/securityDashboard';
import { fmtDateTime } from '@/lib/utils/date';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

const PERIOD_OPTS: { value: ShiftPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last_7_days', label: 'Last 7' },
  { value: 'last_30_days', label: 'Last 30' },
];

function statusPillStyle(status: ShiftStatus | string): { bg: string; fg: string } {
  switch (status) {
    case 'Active':
      return { bg: 'rgba(34,197,94,0.12)', fg: '#166534' };
    case 'Scheduled':
      return { bg: 'rgba(30,136,229,0.12)', fg: '#1E88E5' };
    case 'Cancelled':
      return { bg: 'rgba(239,68,68,0.12)', fg: COLORS.danger };
    case 'Ended':
    default:
      return { bg: COLORS.bgMuted, fg: COLORS.textMuted };
  }
}

function SummaryGrid({ summary }: { summary: ShiftDashboardSummary | undefined }) {
  if (!summary) return null;
  const tiles: { label: string; value: number | string }[] = [
    { label: 'Assignments', value: summary.total_assignments },
    { label: 'Day / Night', value: `${summary.day_shift_count} / ${summary.night_shift_count}` },
    { label: 'Farms covered', value: `${summary.farms_covered}/${summary.farms_total}` },
    { label: 'Unfilled slots', value: summary.unfilled_slots },
    { label: 'Guards on rotation', value: summary.guards_on_rotation },
  ];
  return (
    <View style={s.kpiGrid}>
      {tiles.map((t) => (
        <View key={t.label} style={s.kpiCard}>
          <Text style={s.kpiValue} numberOfLines={1}>{String(t.value)}</Text>
          <Text style={s.kpiLabel}>{t.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ShiftRowCard({ row }: { row: ShiftRow }) {
  const pill = statusPillStyle(row.status);
  return (
    <View style={s.shiftCard}>
      <View style={s.shiftHeaderRow}>
        <View style={[s.farmDot, { backgroundColor: row.farm_color?.bg || COLORS.surfaceAlt }]} />
        <Text style={s.shiftGuardName} numberOfLines={1}>{row.guard_name || row.guard_key}</Text>
        <View style={[s.pill, { backgroundColor: pill.bg }]}>
          <Text style={[s.pillText, { color: pill.fg }]}>{row.status}</Text>
        </View>
      </View>
      <Text style={s.shiftMeta} numberOfLines={1}>
        {row.farm}{row.block ? ` · ${row.block}` : ''} · {row.shift_type} · {row.guard_type}
      </Text>
      <View style={s.shiftTimeRow}>
        <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
        <Text style={s.shiftTime}>
          {row.start_date ? fmtDateTime(row.start_date) : '—'}
          {' → '}
          {row.end_date ? fmtDateTime(row.end_date) : '—'}
        </Text>
      </View>
      {row.remarks ? <Text style={s.shiftRemarks} numberOfLines={2}>{row.remarks}</Text> : null}
    </View>
  );
}

export default function CommandCenterShiftsScreen() {
  const [period, setPeriod] = useState<ShiftPeriod>('today');
  const { data, isLoading, isFetching, error, refetch } = useShiftDashboard({ period });

  return (
    <Screen
      title="Shift Planning"
      onRefresh={async () => { await refetch(); }}
      loading={isLoading && !data}
      error={!isLoading && error ? (error instanceof Error ? error.message : 'Failed to load') : null}
      onRetry={() => refetch()}
    >
      <Segmented value={period} options={PERIOD_OPTS} onChange={setPeriod} />
      <View style={{ height: spacing.md }} />

      {isFetching && data ? (
        <Text style={s.refreshingHint}>Refreshing…</Text>
      ) : null}

      <SummaryGrid summary={data?.summary} />

      {data && data.coverage_board.length > 0 ? (
        <Card title="Coverage board">
          {data.coverage_board.map((row) => (
            <View key={row.farm} style={s.coverageRow}>
              <Text style={s.coverageFarm} numberOfLines={1}>{row.farm}</Text>
              <View style={s.coverageGuards}>
                <View style={s.coverageGuardCol}>
                  <Text style={s.coverageGuardLabel}>DAY</Text>
                  <Text style={s.coverageGuardName} numberOfLines={1}>
                    {row.day_guard || '— unfilled'}
                  </Text>
                </View>
                <View style={s.coverageGuardCol}>
                  <Text style={s.coverageGuardLabel}>NIGHT</Text>
                  <Text style={s.coverageGuardName} numberOfLines={1}>
                    {row.night_guard || '— unfilled'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Text style={s.sectionTitle}>Assignments</Text>
      {data && data.rows.length > 0 ? (
        data.rows.map((row) => <ShiftRowCard key={row.name} row={row} />)
      ) : !isLoading ? (
        <View style={s.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={COLORS.border} />
          <Text style={s.emptyTitle}>No shift assignments in this range</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  refreshingHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    marginBottom: spacing.sm,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kpiCard: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: spacing.sm + 2,
  },
  kpiValue: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: COLORS.text },
  kpiLabel: { fontFamily: fontFamily.medium, fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  coverageRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  coverageFarm: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text, marginBottom: 4 },
  coverageGuards: { flexDirection: 'row', gap: spacing.lg },
  coverageGuardCol: { flex: 1 },
  coverageGuardLabel: { fontFamily: fontFamily.bold, fontSize: 10, color: COLORS.textMuted, letterSpacing: 0.4 },
  coverageGuardName: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  shiftCard: {
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  shiftHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  farmDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  shiftGuardName: { flex: 1, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  pillText: { fontSize: 10, fontFamily: fontFamily.bold, letterSpacing: 0.4 },
  shiftMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 4 },
  shiftTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  shiftTime: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textSecondary },
  shiftRemarks: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 4, fontStyle: 'italic' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { color: COLORS.textMuted, marginTop: spacing.sm, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold },
});
