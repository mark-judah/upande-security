import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { WORKFLOW_META, type WorkflowState } from '@/constants/workflowStates';

type Props = { state: WorkflowState | string; compact?: boolean };

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function StatusChip({ state, compact }: Props) {
  const meta = WORKFLOW_META[state as WorkflowState];
  const color = meta?.color ?? '#757575';
  const icon = (meta?.icon ?? 'info') as keyof typeof MaterialIcons.glyphMap;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: compact ? 8 : 12,
        paddingVertical: compact ? 3 : 6,
        borderRadius: 999,
        backgroundColor: hexWithAlpha(color, 0.1),
        borderWidth: 1,
        borderColor: hexWithAlpha(color, 0.3),
      }}
    >
      <MaterialIcons name={icon} size={compact ? 12 : 14} color={color} />
      <Text
        style={{
          color,
          fontSize: compact ? 11 : 12,
          fontWeight: '600',
          marginLeft: 4,
        }}
      >
        {state}
      </Text>
    </View>
  );
}
