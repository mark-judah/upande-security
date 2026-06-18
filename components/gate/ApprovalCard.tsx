import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { Appointment } from '@/lib/api/types';
import type { ApprovalRoleConfig } from '@/constants/workflowStates';
import { WORKFLOW_META } from '@/constants/workflowStates';
import { format, parseISO } from 'date-fns';

type Props = {
  appointment: Appointment;
  configs: [string, ApprovalRoleConfig][];
  onAction: (name: string, action: string) => void;
  busy?: boolean;
};

function fmtTime(iso?: string) {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'HH:mm, dd MMM'); } catch { return iso; }
}

export function ApprovalCard({ appointment, configs, onAction, busy }: Props) {
  const [expanded, setExpanded] = useState(false);

  const state = appointment.workflow_state as string;
  const meta = WORKFLOW_META[state as keyof typeof WORKFLOW_META];
  const stateColor = meta?.color ?? '#666666';

  // Collect all actions available for this appointment's current state
  const availableActions = configs
    .filter(([, cfg]) => cfg.pendingState === state)
    .flatMap(([, cfg]) => cfg.actions);

  function confirmAction(action: string, label: string) {
    Alert.alert(
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
              {meta ? (
                <MaterialIcons name={meta.icon as any} size={11} color={stateColor} />
              ) : null}
              <Text style={[styles.statePillText, { color: stateColor }]}>
                {state.replace('Pending ', '').replace(' Review', '')}
              </Text>
            </View>
            <MaterialIcons
              name={expanded ? 'expand-less' : 'expand-more'}
              size={20}
              color="#999"
              style={{ marginTop: 4 }}
            />
          </View>
        </TouchableOpacity>

        {/* Scheduled time + phone */}
        <View style={styles.metaRow}>
          <MaterialIcons name="schedule" size={13} color="#888" />
          <Text style={styles.metaText}>{fmtTime(appointment.scheduled_time)}</Text>
          {appointment.customer_phone_number ? (
            <>
              <Text style={styles.metaDot}> · </Text>
              <MaterialIcons name="phone" size={13} color="#888" />
              <Text style={styles.metaText}>{appointment.customer_phone_number}</Text>
            </>
          ) : null}
        </View>

        {/* Expanded detail */}
        {expanded ? (
          <View style={styles.detail}>
            {appointment.customer_details ? (
              <View style={styles.detailRow}>
                <MaterialIcons name="notes" size={13} color="#888" />
                <Text style={styles.detailText}>{appointment.customer_details}</Text>
              </View>
            ) : null}
            {appointment.custom_mode_of_transport ? (
              <View style={styles.detailRow}>
                <MaterialIcons name="directions-car" size={13} color="#888" />
                <Text style={styles.detailText}>{appointment.custom_mode_of_transport}</Text>
              </View>
            ) : null}
            {appointment.custom_check_in_time ? (
              <View style={styles.detailRow}>
                <MaterialIcons name="login" size={13} color="#888" />
                <Text style={styles.detailText}>
                  Checked in: {fmtTime(appointment.custom_check_in_time)}
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
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  stripe: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  sub: {
    fontSize: 12,
    color: '#666666',
    marginTop: 1,
  },
  rightCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  statePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#888888',
    marginLeft: 3,
  },
  metaDot: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  detail: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  detailText: {
    fontSize: 12,
    color: '#555555',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  actionBtn: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
