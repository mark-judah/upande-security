import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { WORKFLOW_META, type WorkflowState } from '@/constants/workflowStates';
import type { Appointment } from '@/lib/api/types';

type Props = { appointment: Appointment };

export function WorkflowTrail({ appointment }: Props) {
  const states: WorkflowState[] = ['Open'];
  if (appointment.custom_check_in_time) states.push('Visitor Checked In');
  if (appointment.custom_check_out_time) states.push('Visitor Checked Out');
  if (!states.includes(appointment.workflow_state)) states.push(appointment.workflow_state);

  return (
    <View
      style={{
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        padding: 10,
        marginTop: 8,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 8 }}>
        Workflow trail
      </Text>
      {states.map((s, i) => {
        const meta = WORKFLOW_META[s];
        const isCurrent = s === appointment.workflow_state;
        const isLast = i === states.length - 1;
        return (
          <View key={`${s}-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ alignItems: 'center', width: 20 }}>
              <MaterialIcons
                name={isCurrent ? 'radio-button-checked' : 'check-circle'}
                size={16}
                color={meta?.color ?? '#999'}
              />
              {!isLast ? (
                <View
                  style={{
                    width: 1.5,
                    height: 16,
                    backgroundColor: '#D0D0D0',
                    marginTop: 2,
                    marginBottom: 2,
                  }}
                />
              ) : null}
            </View>
            <Text
              style={{
                fontSize: 12,
                color: isCurrent ? '#111' : '#666',
                fontWeight: isCurrent ? '600' : '400',
                marginLeft: 6,
                paddingBottom: isLast ? 0 : 10,
              }}
            >
              {s}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
