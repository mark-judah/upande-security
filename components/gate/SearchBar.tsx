import { View, TextInput, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

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
        borderColor: '#D0D0D0',
        borderRadius: 8,
        paddingHorizontal: 12,
        backgroundColor: 'white',
        marginVertical: 8,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A0A0A0"
        onSubmitEditing={onSubmit}
        editable={!disabled}
        returnKeyType="search"
        style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: '#111' }}
      />
      <Pressable onPress={onSubmit} disabled={disabled} hitSlop={8}>
        <MaterialIcons name="search" size={22} color={theme.primaryColor} />
      </Pressable>
    </View>
  );
}
