import { forwardRef } from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { theme } from '@/constants/theme';

type Props = TextInputProps & { label?: string; error?: string };

export const FormInput = forwardRef<TextInput, Props>(function FormInput(
  { label, error, style, ...rest },
  ref,
) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? (
        <Text style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{label}</Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#A0A0A0"
        style={[
          {
            borderWidth: 1,
            borderColor: error ? theme.error : '#D0D0D0',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
            backgroundColor: 'white',
            color: '#111',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={{ color: theme.error, fontSize: 12, marginTop: 4 }}>{error}</Text>
      ) : null}
    </View>
  );
});
