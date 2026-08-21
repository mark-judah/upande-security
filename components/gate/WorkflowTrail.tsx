import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WORKFLOW_META, type WorkflowState } from '@/constants/workflowStates';
import type { Appointment } from '@/lib/api/types';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

type Props = { appointment: Appointment };

export function WorkflowTrail({ appointment }: Props) {
  const current = (appointment.workflow_state as WorkflowState) ?? 'Open';
  const states: WorkflowState[] = ['Open'];
  if (current !== 'Open' && current !== 'Visitor Checked Out') {
    states.push(current);
  }
  if (appointment.custom_check_out_time || current === 'Visitor Checked Out') {
    states.push('Visitor Checked Out');
  }

  return (
    <View
      style={{
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: borderRadius.md,
        padding: 10,
        marginTop: spacing.sm,
      }}
    >
      <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: COLORS.textMuted, marginBottom: spacing.sm }}>
        Workflow trail
      </Text>
      {states.map((s, i) => {
        const meta = WORKFLOW_META[s];
        const isCurrent = s === current;
        const isLast = i === states.length - 1;
        return (
          <View key={`${s}-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ alignItems: 'center', width: 20 }}>
              <Ionicons
                name={isCurrent ? 'radio-button-on' : 'checkmark-circle'}
                size={16}
                color={meta?.color ?? COLORS.textMuted}
              />
              {!isLast ? (
                <View
                  style={{
                    width: 1.5,
                    height: 16,
                    backgroundColor: COLORS.border,
                    marginTop: 2,
                    marginBottom: 2,
                  }}
                />
              ) : null}
            </View>
            <Text
              style={{
                fontSize: fontSize.xs,
                color: isCurrent ? COLORS.text : COLORS.textMuted,
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
