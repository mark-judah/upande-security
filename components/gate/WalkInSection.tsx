import { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, spacing, borderRadius } from '@/src/core/theme';

type Props = {
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  children: ReactNode;
};

export function WalkInSection({ onClose, onSave, saving, children }: Props) {
  return (
    <View style={{ marginTop: spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
        }}
      >
        <Ionicons name="person-add" size={20} color={COLORS.text} />
        <Text
          style={{
            flex: 1,
            marginLeft: spacing.sm,
            fontSize: 15,
            fontWeight: '700',
            color: COLORS.text,
          }}
        >
          Register Walk-In Visitor
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.6}>
          <Ionicons name="close" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={{ height: 1, backgroundColor: COLORS.border, marginBottom: 10 }} />

      {children}

      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: COLORS.primary,
          opacity: saving ? 0.6 : 1,
          borderRadius: borderRadius.md,
          paddingVertical: spacing.lg,
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          marginTop: spacing.xs,
        }}
      >
        <Ionicons name="notifications" size={18} color={COLORS.textOnPrimary} />
        <Text
          style={{ color: COLORS.textOnPrimary, fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}
        >
          NOTIFY HOST
        </Text>
      </TouchableOpacity>
    </View>
  );
}
