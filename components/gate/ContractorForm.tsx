import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContractorSearchResult } from '@/lib/api/types';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

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
          backgroundColor: COLORS.surfaceAlt,
          borderRadius: borderRadius.md,
          padding: 14,
          marginVertical: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="information-circle" size={22} color={COLORS.text} />
          <Text style={{ color: COLORS.text, fontWeight: '700', marginLeft: spacing.sm }}>
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
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: borderRadius.md,
        padding: 14,
        marginVertical: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Ionicons name="construct-outline" size={22} color={COLORS.text} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
            {result.contractor_name ?? '—'}
          </Text>
          {result.contract_name ? (
            <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>Contract: {result.contract_name}</Text>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>
          Number Of People In The Vehicle
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.md,
            backgroundColor: COLORS.surface,
            paddingHorizontal: spacing.md,
          }}
        >
          <Ionicons name="people" size={18} color={COLORS.textMuted} />
          <TextInput
            value={passengers}
            onChangeText={(v) => setPassengers(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="0"
            placeholderTextColor={COLORS.textMuted}
            maxLength={3}
            editable={!busy}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: spacing.sm,
              fontSize: 14,
              color: COLORS.text,
            }}
          />
        </View>
        <Text style={{ fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: spacing.xs }}>
          Leave blank if not applicable
        </Text>
      </View>

      <TouchableOpacity
        onPress={submit}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: COLORS.primary,
          opacity: busy ? 0.6 : 1,
          borderRadius: borderRadius.md,
          paddingVertical: 14,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          marginTop: spacing.md,
        }}
      >
        <Ionicons name="log-in-outline" size={18} color={COLORS.textOnPrimary} />
        <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}>
          CHECK IN
        </Text>
      </TouchableOpacity>
    </View>
  );
}
