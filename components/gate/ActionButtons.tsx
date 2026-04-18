import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Appointment } from '@/lib/api/types';
import type { WorkflowState } from '@/constants/workflowStates';

type Props = {
  appointment: Appointment | null | undefined;
  loading?: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  busy?: boolean;
};

function displayState(a: Appointment): WorkflowState {
  if (a.custom_check_out_time) return 'Visitor Checked Out';
  if (a.custom_check_in_time) return 'Visitor Checked In';
  return (a.workflow_state as WorkflowState) ?? 'Open';
}

export function ActionButtons({ appointment, loading, onCheckIn, onCheckOut, busy }: Props) {
  if (loading || !appointment) {
    return (
      <View style={{ padding: 12, alignItems: 'center' }}>
        <ActivityIndicator color="#000000" />
      </View>
    );
  }

  const checkedIn = Boolean(appointment.custom_check_in_time);
  const checkedOut = Boolean(appointment.custom_check_out_time);
  const state = displayState(appointment);

  if (checkedOut) {
    return (
      <View style={{ marginVertical: 8, alignItems: 'center' }}>
        <StatusChip state={state} />
      </View>
    );
  }

  if (checkedIn) {
    return (
      <View style={{ marginVertical: 8 }}>
        <TouchableOpacity
          onPress={onCheckOut}
          disabled={busy}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            backgroundColor: '#FFFFFF',
            opacity: busy ? 0.6 : 1,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: '#000000',
            paddingVertical: 14,
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
          }}
        >
          <MaterialIcons name="logout" size={18} color="#000000" />
          <Text style={{ color: '#000000', fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}>
            CHECK OUT
          </Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <StatusChip state={state} />
        </View>
      </View>
    );
  }

  return (
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
        marginVertical: 8,
      }}
    >
      <MaterialIcons name="login" size={18} color="#FFFFFF" />
      <Text style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}>
        CHECK IN
      </Text>
    </TouchableOpacity>
  );
}
