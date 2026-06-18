import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WORKFLOW_META, type WorkflowState } from '@/constants/workflowStates';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

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
  const color = meta?.color ?? COLORS.textMuted;
  const icon: keyof typeof Ionicons.glyphMap = meta?.icon ?? 'information-circle';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: compact ? spacing.sm : spacing.md,
        paddingVertical: compact ? 3 : spacing.xs + 2,
        borderRadius: borderRadius.full,
        backgroundColor: hexWithAlpha(color, 0.1),
        borderWidth: 1,
        borderColor: hexWithAlpha(color, 0.3),
      }}
    >
      <Ionicons name={icon} size={compact ? 12 : 14} color={color} />
      <Text
        style={{
          color,
          fontSize: compact ? fontSize.xs : fontSize.sm - 1,
          fontFamily: fontFamily.semiBold,
          marginLeft: spacing.xs,
        }}
      >
        {state}
      </Text>
    </View>
  );
}
