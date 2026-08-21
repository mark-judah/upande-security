import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, spacing, borderRadius } from '@/src/core/theme';

type Props = {
  onRegisterAsWalkIn: () => void;
};

export function NoAppointmentCard({ onRegisterAsWalkIn }: Props) {
  return (
    <View
      style={{
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: borderRadius.md,
        padding: 14,
        marginVertical: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Ionicons name="information-circle" size={22} color={COLORS.text} />
        <Text style={{ color: COLORS.text, fontWeight: '700', marginLeft: spacing.sm }}>
          NO APPOINTMENT FOUND
        </Text>
      </View>
      <TouchableOpacity
        onPress={onRegisterAsWalkIn}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: COLORS.primary,
          borderRadius: borderRadius.md,
          paddingVertical: 14,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', letterSpacing: 0.5 }}>
          REGISTER AS WALK-IN
        </Text>
      </TouchableOpacity>
    </View>
  );
}
