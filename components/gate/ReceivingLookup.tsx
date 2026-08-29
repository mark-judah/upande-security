import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  onScanSupplierBadge?: () => void;
  busy?: boolean;
};

/** Scan or type a PO number / supplier name. Mirrors DispatchLookup's layout. */
export function ReceivingLookup({ value, onChangeText, onSubmit, onScanSupplierBadge, busy }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginTop: spacing.sm }}>
      <TouchableOpacity
        onPress={() => router.push('/scan?intent=receiving')}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: COLORS.primary,
          opacity: busy ? 0.6 : 1,
          paddingVertical: 18,
          borderRadius: borderRadius.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 60,
        }}
      >
        <Ionicons name="qr-code-outline" size={24} color={COLORS.textOnPrimary} />
        <Text
          style={{
            color: COLORS.textOnPrimary,
            fontFamily: fontFamily.bold,
            marginLeft: spacing.sm,
            fontSize: fontSize.md,
            letterSpacing: 0.5,
          }}
        >
          SCAN RECEIVING DOCUMENT
        </Text>
      </TouchableOpacity>

      {onScanSupplierBadge ? (
        <TouchableOpacity
          onPress={onScanSupplierBadge}
          disabled={busy}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={{
            marginTop: spacing.sm,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingVertical: 14,
            borderRadius: borderRadius.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 48,
          }}
        >
          <Ionicons name="id-card-outline" size={18} color={COLORS.text} />
          <Text
            style={{
              color: COLORS.text,
              fontFamily: fontFamily.semiBold,
              marginLeft: spacing.sm,
              fontSize: fontSize.sm,
            }}
          >
            Scan supplier's badge instead
          </Text>
        </TouchableOpacity>
      ) : null}

      <Text
        style={{
          textAlign: 'center',
          color: COLORS.textMuted,
          marginVertical: 10,
          fontSize: fontSize.xs,
          fontFamily: fontFamily.regular,
        }}
      >
        Or enter the PO number / supplier name manually
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: focused ? COLORS.primary : COLORS.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          backgroundColor: COLORS.surface,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="e.g. PUR-ORD-2026-0042 or supplier name"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
          returnKeyType="search"
          onSubmitEditing={onSubmit}
          style={{ flex: 1, paddingVertical: 10, fontSize: fontSize.md, color: COLORS.text }}
        />
        {busy ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <TouchableOpacity onPress={onSubmit} hitSlop={8} activeOpacity={0.6}>
            <Ionicons name="search" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
