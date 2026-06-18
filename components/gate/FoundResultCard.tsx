import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { VisitorAppointmentSearchResult } from '@/lib/api/types';
import { StatusChip } from '@/components/ui/StatusChip';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

type Props = {
  result: VisitorAppointmentSearchResult;
  onProceed: () => void;
  onRegisterAsWalkIn: () => void;
};

export function FoundResultCard({ result, onProceed, onRegisterAsWalkIn }: Props) {
  return (
    <View>
      <View
        style={{
          backgroundColor: COLORS.surfaceAlt,
          borderRadius: borderRadius.md,
          padding: 14,
          marginVertical: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Ionicons name="calendar-outline" size={22} color={COLORS.text} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 }}>
                {result.visitor_name ?? '—'}
              </Text>
              {result.status ? <StatusChip state={result.status} compact /> : null}
            </View>
            {result.phone_number ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>Phone: {result.phone_number}</Text>
            ) : null}
            {result.host_name ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>Visiting: {result.host_name}</Text>
            ) : null}
            {result.scheduled_time ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>
                Scheduled: {result.scheduled_time}
              </Text>
            ) : null}
            {result.purpose ? (
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>Purpose: {result.purpose}</Text>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          onPress={onProceed}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: borderRadius.md,
            paddingVertical: 14,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: spacing.md,
          }}
        >
          <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', letterSpacing: 0.5 }}>PROCEED</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={onRegisterAsWalkIn}
        activeOpacity={0.7}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
        }}
      >
        <Ionicons name="person-add" size={16} color={COLORS.text} />
        <Text style={{ color: COLORS.text, fontSize: fontSize.sm, marginLeft: spacing.xs, fontWeight: '600' }}>
          Different visit? Register as new walk-in
        </Text>
      </TouchableOpacity>
    </View>
  );
}
