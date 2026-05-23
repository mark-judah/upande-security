import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ContractorSearchResult } from '@/lib/api/types';

type Props = {
  result: ContractorSearchResult;
  onCheckIn: (input: { passengers?: number }) => void;
  busy?: boolean;
};

export function ContractorForm({ result, onCheckIn, busy }: Props) {
  const [passengers, setPassengers] = useState('');
  const found = Boolean(result.contract_name || result.contractor_name);

  if (!found) {
    return (
      <View
        style={{
          backgroundColor: '#F5F5F5',
          borderRadius: 10,
          padding: 14,
          marginVertical: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialIcons name="info" size={22} color="#000000" />
          <Text style={{ color: '#000000', fontWeight: '700', marginLeft: 8 }}>
            NO ACTIVE CONTRACT
          </Text>
        </View>
      </View>
    );
  }

  const submit = () => {
    const raw = passengers.trim();
    if (!raw) {
      onCheckIn({});
      return;
    }
    const num = parseInt(raw, 10);
    onCheckIn({
      passengers: Number.isFinite(num) && num >= 0 ? num : undefined,
    });
  };

  return (
    <View
      style={{
        backgroundColor: '#F5F5F5',
        borderRadius: 10,
        padding: 14,
        marginVertical: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <MaterialIcons name="engineering" size={22} color="#000000" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111111' }}>
            {result.contractor_name ?? '—'}
          </Text>
          {result.contract_name ? (
            <Text style={{ color: '#333333', fontSize: 13 }}>Contract: {result.contract_name}</Text>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#444444', marginBottom: 6 }}>
          Number Of People In The Vehicle
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#DDDDDD',
            borderRadius: 8,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 12,
          }}
        >
          <MaterialIcons name="group" size={18} color="#888888" />
          <TextInput
            value={passengers}
            onChangeText={(v) => setPassengers(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="0"
            placeholderTextColor="#BBBBBB"
            maxLength={3}
            editable={!busy}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 8,
              fontSize: 14,
              color: '#111111',
            }}
          />
        </View>
        <Text style={{ fontSize: 11, color: '#888888', marginTop: 4 }}>
          Leave blank if not applicable
        </Text>
      </View>

      <TouchableOpacity
        onPress={submit}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: '#000000',
          opacity: busy ? 0.6 : 1,
          borderRadius: 8,
          paddingVertical: 14,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          marginTop: 12,
        }}
      >
        <MaterialIcons name="login" size={18} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}>
          CHECK IN
        </Text>
      </TouchableOpacity>
    </View>
  );
}
