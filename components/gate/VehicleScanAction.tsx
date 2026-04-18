import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

type Props = {
  onManualSubmit: (value: string) => void;
  disabled?: boolean;
};

export function VehicleScanAction({ onManualSubmit, disabled }: Props) {
  const [manual, setManual] = useState('');

  return (
    <View style={{ marginTop: 12 }}>
      <TouchableOpacity
        onPress={() => router.push('/(app)/scan')}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: '#000000',
          opacity: disabled ? 0.6 : 1,
          paddingVertical: 18,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 60,
        }}
      >
        <MaterialIcons name="qr-code-scanner" size={24} color="#FFFFFF" />
        <Text
          style={{
            color: '#FFFFFF',
            fontWeight: '700',
            marginLeft: 8,
            fontSize: 15,
            letterSpacing: 0.5,
          }}
        >
          SCAN WORK TICKET
        </Text>
      </TouchableOpacity>

      <Text style={{ textAlign: 'center', color: '#666666', marginVertical: 10, fontSize: 12 }}>
        Or enter ticket name manually
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#D0D0D0',
          borderRadius: 8,
          paddingHorizontal: 12,
          backgroundColor: '#FFFFFF',
        }}
      >
        <TextInput
          value={manual}
          onChangeText={setManual}
          placeholder="TDT-2026-0001"
          placeholderTextColor="#A0A0A0"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!disabled}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (manual.trim()) {
              onManualSubmit(manual.trim());
              setManual('');
            }
          }}
          style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: '#111111' }}
        />
        <TouchableOpacity
          onPress={() => {
            if (manual.trim()) {
              onManualSubmit(manual.trim());
              setManual('');
            }
          }}
          disabled={disabled}
          hitSlop={8}
          activeOpacity={0.6}
        >
          <MaterialIcons name="search" size={22} color="#000000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
