import { Text, TouchableOpacity } from 'react-native';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function ChoiceChip({ label, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={{
        paddingHorizontal: spacing.md + 2,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: COLORS.text,
        backgroundColor: selected ? COLORS.text : COLORS.bg,
        marginRight: spacing.sm,
      }}
    >
      <Text
        style={{
          color: selected ? COLORS.textOnPrimary : COLORS.text,
          fontFamily: fontFamily.semiBold,
          fontSize: fontSize.xs,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
