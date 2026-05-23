import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Appointment } from '@/lib/api/types';
import type { WorkflowState } from '@/constants/workflowStates';
import { CHECK_IN_ALLOWED_FROM, TERMINAL_STATES } from '@/constants/workflowStates';

type Props = {
  appointment: Appointment | null | undefined;
  loading?: boolean;
  onNotifyHost: () => void;
  onCheckIn: () => void;
  busy?: boolean;
};

function resolveState(a: Appointment): WorkflowState {
  if (a.custom_check_out_time) return 'Visitor Checked Out';
  if (a.custom_check_in_time) return 'Visitor Checked In';
  return (a.workflow_state as WorkflowState) ?? 'Open';
}

export function ActionButtons({ appointment, loading, onNotifyHost, onCheckIn, busy }: Props) {
  if (loading || !appointment) {
    return (
      <View style={{ padding: 12, alignItems: 'center' }}>
        <ActivityIndicator color="#000000" />
      </View>
    );
  }

  const state = resolveState(appointment);

  // ── Already checked out ─────────────────────────────────────────
  if (state === 'Visitor Checked Out' || state === 'Visitor Checked In') {
    return (
      <View style={{ marginVertical: 8, alignItems: 'center' }}>
        <StatusChip state={state} />
      </View>
    );
  }

  // ── Host approved → CHECK IN ────────────────────────────────────
  if (CHECK_IN_ALLOWED_FROM.includes(state)) {
    return (
      <View style={{ marginVertical: 8 }}>
        <View
          style={{
            backgroundColor: '#F5F5F5',
            borderRadius: 8,
            padding: 10,
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 10,
            borderWidth: 1,
            borderColor: '#E8E8E8',
          }}
        >
          <MaterialIcons name="verified" size={16} color="#000000" />
          <Text style={{ color: '#111111', fontSize: 13, marginLeft: 8, flex: 1, fontWeight: '600' }}>
            Visit approved — check the visitor in.
          </Text>
        </View>
        <TouchableOpacity
          onPress={onCheckIn}
          disabled={busy}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            backgroundColor: '#000000',
            opacity: busy ? 0.6 : 1,
            borderRadius: 8,
            paddingVertical: 16,
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
          }}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <MaterialIcons name="login" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}>
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
      <View style={{ marginVertical: 8 }}>
        <View
          style={{
            backgroundColor: '#F5F5F5',
            borderRadius: 8,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#E8E8E8',
            marginBottom: 10,
          }}
        >
          <MaterialIcons name="notifications-active" size={18} color="#555555" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: '#111111', fontWeight: '700', fontSize: 13 }}>
              Host notified
            </Text>
            <Text style={{ color: '#666666', fontSize: 12, marginTop: 2 }}>
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
      <View style={{ marginVertical: 8, alignItems: 'center' }}>
        <StatusChip state={state} />
      </View>
    );
  }

  // ── Default: Open → NOTIFY HOST ────────────────────────────────
  return (
    <View style={{ marginVertical: 8 }}>
      <TouchableOpacity
        onPress={onNotifyHost}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: '#000000',
          opacity: busy ? 0.6 : 1,
          borderRadius: 8,
          paddingVertical: 16,
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <MaterialIcons name="notifications" size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}>
              NOTIFY HOST
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
