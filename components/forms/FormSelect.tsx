import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, borderRadius, fontSize, spacing } from '@/src/core/theme';
import { TRANSPORT_MODE_ICONS } from '@/constants/transportModes';

type Props = {
  label?: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  error?: string;
  /** Optional sheet title; defaults to the field label. */
  title?: string;
  /** Optional icon resolver for each option. Falls back to a generic marker. */
  iconFor?: (option: string) => keyof typeof Ionicons.glyphMap;
};

// Default icon hints for the common option vocabularies the gate uses —
// sourced from the shared transport-mode constants so this can't drift
// out of sync with VisitorForm / ContractorForm again.
const DEFAULT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  ...TRANSPORT_MODE_ICONS,
};

export function FormSelect({
  label,
  value,
  options,
  onChange,
  error,
  title,
  iconFor,
}: Props) {
  const [open, setOpen] = useState(false);
  const resolveIcon = (opt: string): keyof typeof Ionicons.glyphMap =>
    iconFor?.(opt) ?? DEFAULT_ICONS[opt] ?? 'radio-button-off-outline';

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text
          style={{
            fontSize: fontSize.xs,
            color: COLORS.textMuted,
            marginBottom: spacing.xs,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value || 'unset' }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? COLORS.danger : COLORS.border,
          borderRadius: borderRadius.md,
          paddingLeft: 14,
          paddingRight: 10,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? COLORS.bgMuted : COLORS.bg,
        })}
      >
        <Text
          style={{
            flex: 1,
            fontSize: fontSize.md,
            color: value ? COLORS.text : COLORS.textMuted,
            fontWeight: value ? '500' : '400',
          }}
          numberOfLines={1}
        >
          {value || 'Select…'}
        </Text>
        <Ionicons name="chevron-down" size={22} color={COLORS.textMuted} />
      </Pressable>

      {error ? (
        <Text style={{ color: COLORS.danger, fontSize: fontSize.xs, marginTop: spacing.xs }}>
          {error}
        </Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: COLORS.overlay,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: COLORS.bg,
              borderTopLeftRadius: borderRadius.lg,
              borderTopRightRadius: borderRadius.lg,
              overflow: 'hidden',
            }}
          >
            <SafeAreaView edges={['bottom']}>
              {/* Drag handle */}
              <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: COLORS.border,
                  }}
                />
              </View>

              {/* Header */}
              <View
                style={{
                  paddingHorizontal: spacing.xl,
                  paddingTop: spacing.md,
                  paddingBottom: spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.bgMuted,
                }}
              >
                <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: COLORS.text }}>
                  {title ?? label ?? 'Select an option'}
                </Text>
              </View>

              {/* Options */}
              <ScrollView style={{ maxHeight: 420 }} bounces={false}>
                {options.map((item) => {
                  const isSelected = value === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        onChange(item);
                        setOpen(false);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      style={({ pressed }) => ({
                        width: '100%',
                        backgroundColor: pressed ? COLORS.bgMuted : 'transparent',
                      })}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: spacing.lg,
                          paddingHorizontal: spacing.xl,
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isSelected ? COLORS.text : COLORS.bgMuted,
                            marginRight: 14,
                          }}
                        >
                          <Ionicons
                            name={resolveIcon(item)}
                            size={20}
                            color={isSelected ? COLORS.bg : COLORS.text}
                          />
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: fontSize.md,
                            fontWeight: isSelected ? '600' : '500',
                            color: COLORS.text,
                          }}
                          numberOfLines={1}
                        >
                          {item}
                        </Text>
                        {isSelected ? (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color={COLORS.text}
                            style={{ marginLeft: spacing.md }}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
