import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ContractorSearchResult } from '@/lib/api/types';

type Props = {
  result: ContractorSearchResult;
  onCheckIn: () => void;
  busy?: boolean;
};

export function ContractorForm({ result, onCheckIn, busy }: Props) {
  const found = Boolean(result.contract_name || result.contractor_name);

  if (!found) {
    return (
      <View
        style={{
          backgroundColor: '#F5F5F5',
          borderLeftWidth: 4,
          borderLeftColor: '#000000',
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

  return (
    <View
      style={{
        backgroundColor: '#F5F5F5',
        borderLeftWidth: 4,
        borderLeftColor: '#000000',
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

      <TouchableOpacity
        onPress={onCheckIn}
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
