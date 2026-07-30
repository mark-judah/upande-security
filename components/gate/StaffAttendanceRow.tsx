import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fmtTime, getDuration } from '@/lib/utils/date';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';
import type { Attendance } from '@/lib/api/types';

type Props = { attendance: Attendance };

function durationBetween(inIso?: string, outIso?: string): string {
  if (!inIso || !outIso) return '';
  const diff = new Date(outIso).getTime() - new Date(inIso).getTime();
  if (diff < 0) return '';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff / 60_000) % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function StaffAttendanceRow({ attendance: a }: Props) {
  const checkedOut = Boolean(a.out_time);
  const currentlyInside = Boolean(a.in_time) && !checkedOut;
  const steppedOut = currentlyInside && Boolean(a.custom_temp_exit_time);
  const bg = checkedOut ? COLORS.surfaceAlt : currentlyInside ? COLORS.bgMuted : COLORS.surface;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: bg,
          borderLeftColor: currentlyInside ? COLORS.success : COLORS.border,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="card-outline" size={18} color={currentlyInside ? COLORS.success : COLORS.textMuted} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.name} numberOfLines={1}>
            {a.employee_name ?? a.employee}
          </Text>
          <View style={styles.detailRow}>
            <Text style={styles.timeText}>
              {a.in_time ? `In ${fmtTime(a.in_time)}` : '—'}
              {checkedOut ? ` → Out ${fmtTime(a.out_time)}` : ''}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.durationText}>
              {checkedOut
                ? durationBetween(a.in_time, a.out_time)
                : currentlyInside
                  ? getDuration(a.in_time)
                  : ''}
            </Text>
            {steppedOut ? (
              <View style={[styles.statusBadge, { backgroundColor: COLORS.warn }]}>
                <Text style={styles.statusBadgeText}>STEPPED OUT</Text>
              </View>
            ) : currentlyInside ? (
              <View style={[styles.statusBadge, { backgroundColor: COLORS.text }]}>
                <Text style={styles.statusBadgeText}>INSIDE</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  name: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: COLORS.text,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  timeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: COLORS.textSecondary,
  },
  durationText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: COLORS.textMuted,
  },
  statusBadge: {
    marginLeft: spacing.sm - 2,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    color: COLORS.textOnPrimary,
    fontSize: 9,
    fontFamily: fontFamily.bold,
  },
});
