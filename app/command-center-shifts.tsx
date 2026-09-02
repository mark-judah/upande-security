import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Screen } from '@/src/core/ui/Screen';
import { Card, Alert as InlineAlert } from '@/src/core/ui/Card';
import { Segmented } from '@/src/core/ui/Segmented';
import { Dropdown } from '@/src/core/ui/Dropdown';
import { Input } from '@/src/core/ui/Input';
import { Button } from '@/src/core/ui/Button';
import { useShiftDashboard } from '@/lib/hooks/useShiftDashboard';
import { useUpdateShiftAssignment } from '@/lib/hooks/useUpdateShiftAssignment';
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

// Real Select options from Security Guard Shift Assignment.status — see
// frappe/…/doctype/security_guard_shift_assignment/security_guard_shift_assignment.json.
const STATUS_OPTS: { value: ShiftStatus; label: string }[] = [
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Active', label: 'Active' },
  { value: 'Ended', label: 'Ended' },
  { value: 'Cancelled', label: 'Cancelled' },
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

// --- Date/Time helpers ---------------------------------------------------
// ShiftRow.start_date / end_date arrive as a combined "YYYY-MM-DD HH:MM:SS"
// (or null) even though the underlying doctype fields are split Date +
// Time — the read-side aggregation (securityDashboard.ts) combines them for
// display. The edit form works on the real split fields, so these helpers
// split/parse a Date object purely from its own local getters (no Nairobi
// offset conversion — Date/Time doctype fields carry no timezone, so a
// straight local-getter round trip keeps whatever wall-clock value the
// picker shows, unlike toFrappeDateTime's UTC->Nairobi shift which is only
// correct for actual instant/datetime fields).

function splitDatePart(combined: string | null): string {
  return combined ? combined.split(' ')[0] : '';
}
function splitTimePart(combined: string | null): string {
  if (!combined) return '';
  const parts = combined.split(' ');
  return parts[1] || '';
}
function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = (dateStr || '').split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}
function parseTimeOnly(timeStr: string): Date {
  const base = new Date();
  const [hh, mm, ss] = (timeStr || '').split(':').map((n) => parseInt(n, 10));
  base.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, Number.isFinite(ss) ? ss : 0, 0);
  return base;
}
function fmtDateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtTimeOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function fmtDateOnlyDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  return dateStr;
}
function fmtTimeOnlyDisplay(timeStr: string): string {
  if (!timeStr) return '—';
  return timeStr.slice(0, 5);
}

function ShiftRowCard({ row }: { row: ShiftRow }) {
  const pill = statusPillStyle(row.status);
  const [expanded, setExpanded] = useState(false);

  // ShiftRow (list side, securityDashboard.ts) calls this field `guard_type`;
  // the update_shift_assignment RESPONSE calls the equivalent field
  // `security_guard` (see UpdateShiftAssignmentResult in lib/services/api.ts)
  // — same 'Internal Guard' | 'External Guard' values, different field name
  // on each side of the read/write split. Both mean the same lock.
  const isInternal = row.guard_type === 'Internal Guard';

  const [status, setStatus] = useState<ShiftStatus>(row.status);
  const [startDate, setStartDate] = useState<string>(splitDatePart(row.start_date));
  const [startTime, setStartTime] = useState<string>(splitTimePart(row.start_date));
  const [endDate, setEndDate] = useState<string>(splitDatePart(row.end_date));
  const [endTime, setEndTime] = useState<string>(splitTimePart(row.end_date));
  const [remarks, setRemarks] = useState<string>(row.remarks || '');

  const [pickerOpen, setPickerOpen] = useState<'startDate' | 'startTime' | 'endDate' | 'endTime' | null>(null);

  const updateShift = useUpdateShiftAssignment();

  // Re-sync local edit state whenever the row's own data changes (e.g.
  // after a refetch following save) or when re-opened.
  useEffect(() => {
    if (!expanded) return;
    setStatus(row.status);
    setStartDate(splitDatePart(row.start_date));
    setStartTime(splitTimePart(row.start_date));
    setEndDate(splitDatePart(row.end_date));
    setEndTime(splitTimePart(row.end_date));
    setRemarks(row.remarks || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, row.name]);

  const onPickerChange = (field: 'startDate' | 'startTime' | 'endDate' | 'endTime') =>
    (event: DateTimePickerEvent, d?: Date) => {
      if (Platform.OS === 'android') setPickerOpen(null);
      if (event.type === 'dismissed' || !d) return;
      if (field === 'startDate') setStartDate(fmtDateOnly(d));
      else if (field === 'startTime') setStartTime(fmtTimeOnly(d));
      else if (field === 'endDate') setEndDate(fmtDateOnly(d));
      else setEndTime(fmtTimeOnly(d));
    };

  const onSave = async () => {
    try {
      const payload: Parameters<typeof updateShift.mutateAsync>[0] = {
        name: row.name,
        status,
        remarks,
      };
      if (!isInternal) {
        payload.start_date = startDate || undefined;
        payload.start_time = startTime || undefined;
        payload.end_date = endDate || undefined;
        payload.end_time = endTime || undefined;
      }
      await updateShift.mutateAsync(payload);
      setExpanded(false);
    } catch (e) {
      Alert.alert('Could not save shift', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <View style={s.shiftCard}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse shift details' : 'Edit shift'}
      >
        <View style={s.shiftHeaderRow}>
          <View style={[s.farmDot, { backgroundColor: row.farm_color?.bg || COLORS.surfaceAlt }]} />
          <Text style={s.shiftGuardName} numberOfLines={1}>{row.guard_name || row.guard_key}</Text>
          <View style={[s.pill, { backgroundColor: pill.bg }]}>
            <Text style={[s.pillText, { color: pill.fg }]}>{row.status}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.textMuted}
            style={{ marginLeft: spacing.xs }}
          />
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
      </Pressable>

      {expanded ? (
        <View style={s.editForm}>
          <View style={s.divider} />

          {isInternal ? (
            <InlineAlert tone="info">
              Internal Guard shifts are HR-mirrored — dates and times come from the roster and
              can only be changed there. Only status and remarks can be edited here.
            </InlineAlert>
          ) : null}

          <Dropdown
            label="Status"
            value={status}
            options={STATUS_OPTS.map((o) => ({ label: o.label, value: o.value }))}
            searchable={false}
            onChange={(v) => setStatus(v as ShiftStatus)}
          />

          <Text style={s.fieldLabel}>Start</Text>
          <View style={s.dateTimeRow}>
            <PickerField
              icon="calendar-outline"
              value={fmtDateOnlyDisplay(startDate)}
              disabled={isInternal}
              onPress={() => setPickerOpen('startDate')}
              style={{ flex: 1.3 }}
            />
            <PickerField
              icon="time-outline"
              value={fmtTimeOnlyDisplay(startTime)}
              disabled={isInternal}
              onPress={() => setPickerOpen('startTime')}
              style={{ flex: 1 }}
            />
          </View>

          <Text style={s.fieldLabel}>End</Text>
          <View style={s.dateTimeRow}>
            <PickerField
              icon="calendar-outline"
              value={fmtDateOnlyDisplay(endDate)}
              disabled={isInternal}
              onPress={() => setPickerOpen('endDate')}
              style={{ flex: 1.3 }}
            />
            <PickerField
              icon="time-outline"
              value={fmtTimeOnlyDisplay(endTime)}
              disabled={isInternal}
              onPress={() => setPickerOpen('endTime')}
              style={{ flex: 1 }}
            />
          </View>

          {pickerOpen === 'startDate' ? (
            <DateTimePicker value={parseDateOnly(startDate)} mode="date" onChange={onPickerChange('startDate')} />
          ) : null}
          {pickerOpen === 'startTime' ? (
            <DateTimePicker value={parseTimeOnly(startTime)} mode="time" is24Hour onChange={onPickerChange('startTime')} />
          ) : null}
          {pickerOpen === 'endDate' ? (
            <DateTimePicker value={parseDateOnly(endDate)} mode="date" onChange={onPickerChange('endDate')} />
          ) : null}
          {pickerOpen === 'endTime' ? (
            <DateTimePicker value={parseTimeOnly(endTime)} mode="time" is24Hour onChange={onPickerChange('endTime')} />
          ) : null}

          <Input
            label="Remarks"
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Optional notes"
            multiline
            numberOfLines={3}
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />

          <View style={s.actionRow}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setExpanded(false)}
              disabled={updateShift.isPending}
              style={{ flex: 1 }}
            />
            <Button
              label="Save"
              loading={updateShift.isPending}
              disabled={updateShift.isPending}
              onPress={onSave}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function PickerField({
  icon,
  value,
  disabled,
  onPress,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  disabled?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[s.pickerField, disabled && s.pickerFieldDisabled, style]}
    >
      <Ionicons name={icon} size={14} color={COLORS.textMuted} />
      <Text style={s.pickerFieldText} numberOfLines={1}>{value}</Text>
    </Pressable>
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

  editForm: { marginTop: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginBottom: spacing.md },
  fieldLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: COLORS.text,
    marginBottom: spacing.sm,
  },
  dateTimeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: COLORS.bg,
  },
  pickerFieldDisabled: { opacity: 0.55 },
  pickerFieldText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.text, flexShrink: 1 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
