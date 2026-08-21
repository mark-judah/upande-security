import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Appointment } from '@/lib/api/types';
import type { WorkflowState } from '@/constants/workflowStates';
import { CHECK_IN_ALLOWED_FROM, TERMINAL_STATES } from '@/constants/workflowStates';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

type Props = {
  appointment: Appointment | null | undefined;
  loading?: boolean;
  onNotifyHost: () => void;
  onCheckIn: () => void;
  busy?: boolean;
  /** When set, CHECK IN is disabled and this message is shown instead of the button being active. Visitor flow only — issuing a physical badge before letting someone in. */
  checkInBlockedReason?: string;
};

function resolveState(a: Appointment): WorkflowState {
  if (a.custom_check_out_time) return 'Visitor Checked Out';
  if (a.custom_check_in_time) return 'Visitor Checked In';
  return (a.workflow_state as WorkflowState) ?? 'Open';
}

export function ActionButtons({
  appointment,
  loading,
  onNotifyHost,
  onCheckIn,
  busy,
  checkInBlockedReason,
}: Props) {
  if (loading || !appointment) {
    return (
      <View style={{ padding: spacing.md, alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const state = resolveState(appointment);

  // ── Already checked out ─────────────────────────────────────────
  if (state === 'Visitor Checked Out' || state === 'Visitor Checked In') {
    return (
      <View style={{ marginVertical: spacing.sm, alignItems: 'center' }}>
        <StatusChip state={state} />
      </View>
    );
  }

  // ── Host approved → CHECK IN ────────────────────────────────────
  if (CHECK_IN_ALLOWED_FROM.includes(state)) {
    const blocked = Boolean(checkInBlockedReason);
    return (
      <View style={{ marginVertical: spacing.sm }}>
        <View
          style={{
            backgroundColor: blocked ? '#FFFBEB' : COLORS.surfaceAlt,
            borderRadius: borderRadius.md,
            padding: 10,
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 10,
            borderWidth: 1,
            borderColor: blocked ? COLORS.warn : COLORS.border,
          }}
        >
          <Ionicons
            name={blocked ? 'alert-circle' : 'checkmark-circle'}
            size={16}
            color={blocked ? COLORS.warn : COLORS.primary}
          />
          <Text style={{ color: COLORS.text, fontSize: fontSize.sm, marginLeft: spacing.sm, flex: 1, fontWeight: '600' }}>
            {blocked ? checkInBlockedReason : 'Visit approved — check the visitor in.'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onCheckIn}
          disabled={busy || blocked}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            backgroundColor: COLORS.primary,
            opacity: busy || blocked ? 0.4 : 1,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.lg,
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
          }}
        >
          {busy ? (
            <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
          ) : (
            <>
              <Ionicons name="log-in-outline" size={18} color={COLORS.textOnPrimary} />
              <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}>
                CHECK IN
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Notification sent — awaiting host ───────────────────────────
  if (state === 'Pending Host Review') {
    return (
      <View style={{ marginVertical: spacing.sm }}>
        <View
          style={{
            backgroundColor: COLORS.surfaceAlt,
            borderRadius: borderRadius.md,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.border,
            marginBottom: 10,
          }}
        >
          <Ionicons name="notifications" size={18} color={COLORS.textMuted} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: fontSize.sm }}>
              Host notified
            </Text>
            <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
              Check the Pending tab while waiting for approval.
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'center' }}>
          <StatusChip state={state} />
        </View>
      </View>
    );
  }

  // ── Terminal without check-in (rejected / rescheduled) ──────────
  if (
    TERMINAL_STATES.includes(state) ||
    state === 'Rescheduled by Host' ||
    state === 'Rescheduled by Secretary'
  ) {
    return (
      <View style={{ marginVertical: spacing.sm, alignItems: 'center' }}>
        <StatusChip state={state} />
      </View>
    );
  }

  // ── Default: Open → NOTIFY HOST ────────────────────────────────
  return (
    <View style={{ marginVertical: spacing.sm }}>
      <TouchableOpacity
        onPress={onNotifyHost}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: COLORS.primary,
          opacity: busy ? 0.6 : 1,
          borderRadius: borderRadius.md,
          paddingVertical: spacing.lg,
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}
      >
        {busy ? (
          <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
        ) : (
          <>
            <Ionicons name="notifications" size={18} color={COLORS.textOnPrimary} />
            <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}>
              NOTIFY HOST
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
