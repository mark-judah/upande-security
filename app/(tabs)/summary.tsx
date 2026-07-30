import { Alert, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDailySummary } from '@/lib/hooks/useDailySummary';
import { useCheckOut } from '@/lib/hooks/useCheckOut';
import { useStaffAttendanceSummary } from '@/lib/hooks/useStaffAttendanceSummary';
import { InsideCard } from '@/components/gate/InsideCard';
import { ActivityRow } from '@/components/gate/ActivityRow';
import { StaffAttendanceRow } from '@/components/gate/StaffAttendanceRow';
import { fmtLongDate } from '@/lib/utils/date';
import { COLORS, fontFamily, fontSize, spacing, borderRadius, shadow } from '@/src/core/theme';
import { Button } from '@/src/core/ui/Button';
import { Screen } from '@/src/core/ui/Screen';

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={s.statCard}>
      <Ionicons name={icon} size={28} color={color} />
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export default function SummaryTab() {
  const today = new Date();
  const { data, isFetching, isLoading, refetch, error } = useDailySummary(today);
  const staffAttendance = useStaffAttendanceSummary();
  const checkOut = useCheckOut();

  function confirmCheckOut(name: string) {
    Alert.alert(
      'Check Out',
      'Mark this visitor as checked out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          style: 'destructive',
          onPress: () => checkOut.mutate(name),
        },
      ],
    );
  }

  if (!data && !isLoading && !error) {
    return (
      <Screen title="Summary">
        <View style={s.empty}>
          <Ionicons name="grid-outline" size={60} color={COLORS.textMuted} />
          <Button
            label="Load Today's Summary"
            onPress={() => refetch()}
            iconLeft="refresh-outline"
            style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Summary"
      onRefresh={async () => {
        await Promise.all([refetch(), staffAttendance.refetch()]);
      }}
    >
      <Text style={s.pageTitle}>Gate Activity — {fmtLongDate(today)}</Text>

      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>
            {error instanceof Error ? error.message : 'Failed to load summary'}
          </Text>
        </View>
      ) : null}

      {data ? (
        <>
          <View style={s.statRow}>
            <StatCard
              label="Checked In"
              value={data.total_checked_in}
              color={COLORS.text}
              icon="log-in-outline"
            />
            <StatCard
              label="Checked Out"
              value={data.total_checked_out}
              color={COLORS.textMuted}
              icon="log-out-outline"
            />
          </View>
          <View style={[s.statRow, { marginBottom: spacing.lg }]}>
            <StatCard
              label="Inside"
              value={data.still_inside}
              color={COLORS.text}
              icon="person-outline"
            />
            <StatCard
              label="Total"
              value={data.all.length}
              color={COLORS.textMuted}
              icon="people-outline"
            />
          </View>

          {data.still_inside_list.length > 0 ? (
            <View style={{ marginBottom: spacing.lg }}>
              <View style={s.sectionHeader}>
                <Ionicons name="location-outline" size={18} color={COLORS.textOnPrimary} />
                <Text style={s.sectionHeaderText}>
                  Currently on Premises ({data.still_inside_list.length})
                </Text>
              </View>
              {data.still_inside_list.map((a) => (
                <InsideCard
                  key={a.name}
                  appointment={a}
                  onCheckOut={confirmCheckOut}
                  busy={checkOut.isPending && checkOut.variables === a.name}
                />
              ))}
            </View>
          ) : null}

          {staffAttendance.error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>
                {staffAttendance.error instanceof Error
                  ? staffAttendance.error.message
                  : 'Failed to load staff attendance'}
              </Text>
            </View>
          ) : null}

          {staffAttendance.data && staffAttendance.data.length > 0 ? (
            <View style={{ marginBottom: spacing.lg }}>
              <View style={s.sectionHeader}>
                <Ionicons name="id-card-outline" size={18} color={COLORS.textOnPrimary} />
                <Text style={s.sectionHeaderText}>
                  Staff Attendance Today ({staffAttendance.data.length})
                </Text>
              </View>
              {staffAttendance.data.map((a) => (
                <StaffAttendanceRow key={a.name} attendance={a} />
              ))}
            </View>
          ) : null}

          {data.all.length > 0 ? (
            <View>
              <Text style={s.activityTitle}>Today&apos;s Activity Log</Text>
              {data.all.map((a) => (
                <ActivityRow key={a.name} appointment={a} />
              ))}
            </View>
          ) : (
            <View style={s.emptyActivity}>
              <Ionicons name="file-tray-outline" size={40} color={COLORS.textMuted} />
              <Text style={s.emptyActivityText}>No activity yet today</Text>
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.bgMuted },
  content: { padding: spacing.md, paddingBottom: 40 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: COLORS.bgMuted,
  },
  pageTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    color: COLORS.text,
    marginBottom: spacing.md,
  },
  errorBox: {
    backgroundColor: COLORS.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: { color: COLORS.danger, fontSize: fontSize.sm, fontFamily: fontFamily.regular },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    ...shadow.sm,
  },
  statValue: { fontSize: 28, fontFamily: fontFamily.bold, marginTop: 2 },
  statLabel: { fontSize: fontSize.xs, color: COLORS.textMuted, fontFamily: fontFamily.regular, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.text,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  sectionHeaderText: {
    color: COLORS.textOnPrimary,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    marginLeft: spacing.sm - 2,
  },
  activityTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    color: COLORS.textSecondary,
    marginBottom: spacing.sm,
  },
  emptyActivity: { padding: 32, alignItems: 'center' },
  emptyActivityText: {
    color: COLORS.textMuted,
    fontFamily: fontFamily.regular,
    marginTop: spacing.sm,
  },
});
