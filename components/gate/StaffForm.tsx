import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StaffSearchResult } from '@/lib/api/types';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

type Props = {
  result: StaffSearchResult;
  onCheckIn: () => void;
  busy?: boolean;
};

export function StaffForm({ result, onCheckIn, busy }: Props) {
  const found = Boolean(result.full_name || result.employee_id);

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
            NO STAFF MATCH
          </Text>
        </View>
      </View>
    );
  }

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
        {/* TODO: Wave 4 follow-up — icon mapping: no direct Ionicons equivalent for 'badge' */}
        <Ionicons name="card-outline" size={22} color={COLORS.text} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
            {result.full_name ?? '—'}
          </Text>
          {result.employee_id ? (
            <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>ID: {result.employee_id}</Text>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        onPress={onCheckIn}
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
