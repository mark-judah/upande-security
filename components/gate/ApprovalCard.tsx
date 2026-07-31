import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert as RNAlert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Appointment } from '@/lib/api/types';
import type { ApprovalRoleConfig } from '@/constants/workflowStates';
import { WORKFLOW_META } from '@/constants/workflowStates';
import { fmtDateTime } from '@/lib/utils/date';
import { COLORS, spacing, borderRadius, fontFamily, fontSize, shadow } from '@/src/core/theme';

type Props = {
  appointment: Appointment;
  configs: [string, ApprovalRoleConfig][];
  onAction: (name: string, action: string) => void;
  busy?: boolean;
};

export function ApprovalCard({ appointment, configs, onAction, busy }: Props) {
  const [expanded, setExpanded] = useState(false);

  const state = appointment.workflow_state as string;
  const meta = WORKFLOW_META[state as keyof typeof WORKFLOW_META];
  const stateColor = meta?.color ?? COLORS.textMuted;

  // Collect all actions available for this appointment's current state
  const availableActions = configs
    .filter(([, cfg]) => cfg.pendingState === state)
    .flatMap(([, cfg]) => cfg.actions);

  function confirmAction(action: string, label: string) {
    RNAlert.alert(
      `${label} visit?`,
      `${label} the visit for ${appointment.customer_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          style: label === 'Reject' ? 'destructive' : 'default',
          onPress: () => onAction(appointment.name, action),
        },
      ],
    );
  }

  return (
    <View style={styles.card}>
      {/* Color stripe */}
      <View style={[styles.stripe, { backgroundColor: stateColor }]} />

      <View style={styles.body}>
        {/* Header row */}
        <TouchableOpacity
          onPress={() => setExpanded((e) => !e)}
          activeOpacity={0.7}
          style={styles.headerRow}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{appointment.customer_name}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {appointment.host_name
                ? `Visiting: ${appointment.host_name}`
                : appointment.custom_meet_with ?? ''}
            </Text>
          </View>
          <View style={styles.rightCol}>
            <View style={[styles.statePill, { borderColor: stateColor }]}>
              {meta ? <Ionicons name={meta.icon} size={11} color={stateColor} /> : null}
              <Text style={[styles.statePillText, { color: stateColor }]}>
                {state.replace('Pending ', '').replace(' Review', '')}
              </Text>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={20}
              color={COLORS.textMuted}
              style={{ marginTop: 4 }}
            />
          </View>
        </TouchableOpacity>

        {/* Scheduled time + phone */}
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.metaText}>{fmtDateTime(appointment.scheduled_time)}</Text>
          {appointment.customer_phone_number ? (
            <>
              <Text style={styles.metaDot}> · </Text>
              <Ionicons name="call-outline" size={13} color={COLORS.textMuted} />
              <Text style={styles.metaText}>{appointment.customer_phone_number}</Text>
            </>
          ) : null}
        </View>

        {/* Expanded detail */}
        {expanded ? (
          <View style={styles.detail}>
            {appointment.customer_details ? (
              <View style={styles.detailRow}>
                <Ionicons name="document-text-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.detailText}>{appointment.customer_details}</Text>
              </View>
            ) : null}
            {appointment.custom_mode_of_transport ? (
              <View style={styles.detailRow}>
                <Ionicons name="car-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.detailText}>{appointment.custom_mode_of_transport}</Text>
              </View>
            ) : null}
            {appointment.custom_check_in_time ? (
              <View style={styles.detailRow}>
                <Ionicons name="log-in-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.detailText}>
                  Checked in: {fmtDateTime(appointment.custom_check_in_time)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Action buttons */}
        {availableActions.length > 0 ? (
          <View style={styles.actions}>
            {availableActions.map((a) => (
              <TouchableOpacity
                key={a.action}
                onPress={() => confirmAction(a.action, a.label)}
                disabled={busy}
                activeOpacity={0.8}
                style={[styles.actionBtn, { borderColor: a.color, opacity: busy ? 0.5 : 1 }]}
              >
                <Text style={[styles.actionBtnText, { color: a.color }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm + 2,
    overflow: 'hidden',
    ...shadow.sm,
  },
  stripe: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  name: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semiBold,
    color: COLORS.text,
  },
  sub: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  rightCol: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 2,
    gap: 3,
  },
  statePillText: {
    fontSize: 10,
    fontFamily: fontFamily.semiBold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm - 2,
  },
  metaText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: COLORS.textMuted,
    marginLeft: 3,
  },
  metaDot: {
    fontSize: fontSize.xs,
    color: COLORS.border,
  },
  detail: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  detailText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: COLORS.textSecondary,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm - 2,
    marginTop: spacing.sm + 2,
  },
  actionBtn: {
    borderWidth: 1.5,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  actionBtnText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semiBold,
  },
});
