import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTractorTaskSearch } from '@/lib/hooks/useTractorTaskSearch';
import type { TractorTaskSearchResult } from '@/lib/api/vehicles';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

type Props = {
  onPickTicket: (name: string) => void;
  disabled?: boolean;
};

export function VehicleScanAction({ onPickTicket, disabled }: Props) {
  const [query, setQuery] = useState('');
  const search = useTractorTaskSearch();
  const results: TractorTaskSearchResult[] = search.data ?? [];

  function onSearch() {
    const q = query.trim();
    if (!q) return;
    search.mutate(q);
  }

  return (
    <View style={{ marginTop: spacing.md }}>
      <TouchableOpacity
        onPress={() => router.push('/scan')}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: COLORS.primary,
          opacity: disabled ? 0.6 : 1,
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
            fontWeight: '700',
            marginLeft: spacing.sm,
            fontSize: fontSize.md,
            letterSpacing: 0.5,
          }}
        >
          SCAN WORK TICKET
        </Text>
      </TouchableOpacity>

      <Text style={{ textAlign: 'center', color: COLORS.textMuted, marginVertical: 10, fontSize: fontSize.xs }}>
        Or search by ticket / vehicle reg
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          backgroundColor: COLORS.surface,
        }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. KAY or 310780"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!disabled}
          returnKeyType="search"
          onSubmitEditing={onSearch}
          style={{ flex: 1, paddingVertical: 10, fontSize: fontSize.md, color: COLORS.text }}
        />
        {search.isPending ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <TouchableOpacity
            onPress={onSearch}
            disabled={disabled}
            hitSlop={8}
            activeOpacity={0.6}
          >
            <Ionicons name="search" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {search.isSuccess && results.length === 0 ? (
        <View style={{ padding: spacing.lg, alignItems: 'center' }}>
          <Ionicons name="archive-outline" size={28} color={COLORS.textMuted} />
          <Text style={{ color: COLORS.textMuted, marginTop: 6, fontSize: fontSize.xs }}>
            No tickets match &quot;{query}&quot;
          </Text>
        </View>
      ) : null}

      {results.length > 0 ? (
        <View
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.md,
            backgroundColor: COLORS.surface,
            overflow: 'hidden',
          }}
        >
          {results.map((r, i) => (
            <TouchableOpacity
              key={r.name}
              onPress={() => onPickTicket(r.name)}
              activeOpacity={0.7}
              style={{
                padding: spacing.md,
                borderBottomWidth: i === results.length - 1 ? 0 : 1,
                borderBottomColor: COLORS.bgMuted,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: borderRadius.md,
                  backgroundColor: COLORS.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="leaf-outline" size={20} color={COLORS.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontWeight: '700', color: COLORS.text, fontSize: fontSize.sm }}
                >
                  {r.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginTop: 2 }}
                >
                  {[r.motor_vehicle, r.farm].filter(Boolean).join(' · ') || '—'}
                </Text>
                {r.date || r.workflow_state ? (
                  <Text
                    numberOfLines={1}
                    style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginTop: 2 }}
                  >
                    {[r.date, r.workflow_state].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}
