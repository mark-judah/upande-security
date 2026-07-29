import { forwardRef } from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { COLORS, borderRadius, fontSize, spacing } from '@/src/core/theme';

type Props = TextInputProps & { label?: string; error?: string };

export const FormInput = forwardRef<TextInput, Props>(function FormInput(
  { label, error, style, ...rest },
  ref,
) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text style={{ fontSize: fontSize.sm, color: COLORS.textMuted, marginBottom: spacing.xs }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={COLORS.textMuted}
        style={[
          {
            borderWidth: 1,
            borderColor: error ? COLORS.danger : COLORS.border,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
            fontSize: fontSize.md,
            backgroundColor: COLORS.bg,
            color: COLORS.text,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={{ color: COLORS.danger, fontSize: fontSize.xs, marginTop: spacing.xs }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});
