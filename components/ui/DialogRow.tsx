import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
};

export function DialogRow({ icon, label, value }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xs + 2 }}>
      <Ionicons name={icon} size={18} color={COLORS.textSecondary} />
      <Text
        style={{
          color: COLORS.textMuted,
          fontSize: fontSize.xs,
          fontFamily: fontFamily.regular,
          marginLeft: spacing.sm,
          width: 70,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: COLORS.text,
          fontSize: fontSize.sm + 1,
          flex: 1,
          fontFamily: fontFamily.medium,
        }}
      >
        {value ?? '—'}
      </Text>
    </View>
  );
}
