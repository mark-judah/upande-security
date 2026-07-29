import { View, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, spacing, borderRadius } from '@/src/core/theme';

type Props = {
  value: string;
  placeholder?: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
};

export function SearchBar({ value, placeholder, onChangeText, onSubmit, disabled }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        backgroundColor: COLORS.surface,
        marginVertical: spacing.sm,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        onSubmitEditing={onSubmit}
        editable={!disabled}
        returnKeyType="search"
        style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: COLORS.text }}
      />
      <Pressable onPress={onSubmit} disabled={disabled} hitSlop={8}>
        <Ionicons name="search" size={22} color={COLORS.primary} />
      </Pressable>
    </View>
  );
}
