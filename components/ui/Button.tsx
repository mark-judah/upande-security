import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import { COLORS } from '@/constants/colors';

export function Button({
  label,
  onPress,
  color = COLORS.info,
  disabled,
  loading,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline';
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  const bg = variant === 'outline' ? 'transparent' : color;
  const textColor = variant === 'outline' ? color : '#FFFFFF';
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      style={[
        s.btn,
        {
          backgroundColor: bg,
          borderColor: color,
          opacity: isDisabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[s.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '600' },
});
