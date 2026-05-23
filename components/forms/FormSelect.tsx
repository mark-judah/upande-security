import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';

type Props = {
  label?: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  error?: string;
  /** Optional sheet title; defaults to the field label. */
  title?: string;
  /** Optional icon resolver for each option. Falls back to a generic marker. */
  iconFor?: (option: string) => React.ComponentProps<typeof MaterialIcons>['name'];
};

// Default icon hints for the common option vocabularies the gate uses.
const DEFAULT_ICONS: Record<string, React.ComponentProps<typeof MaterialIcons>['name']> = {
  'On Foot': 'directions-walk',
  Vehicle: 'directions-car',
  'Motor Bike': 'two-wheeler',
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
  const resolveIcon = (opt: string) =>
    iconFor?.(opt) ?? DEFAULT_ICONS[opt] ?? 'radio-button-unchecked';

  return (
    <View style={{ marginBottom: 12 }}>
      {label ? (
        <Text
          style={{
            fontSize: 11,
            color: COLORS.textMuted,
            marginBottom: 4,
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
          borderRadius: 8,
          paddingLeft: 14,
          paddingRight: 10,
          paddingVertical: 12,
          backgroundColor: pressed ? COLORS.bgMuted : COLORS.bg,
        })}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            color: value ? COLORS.text : COLORS.textMuted,
            fontWeight: value ? '500' : '400',
          }}
          numberOfLines={1}
        >
          {value || 'Select…'}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={22} color={COLORS.textMuted} />
      </Pressable>

      {error ? (
        <Text style={{ color: COLORS.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>
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
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: COLORS.bg,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              overflow: 'hidden',
            }}
          >
            <SafeAreaView edges={['bottom']}>
              {/* Drag handle */}
              <View style={{ alignItems: 'center', paddingTop: 8 }}>
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
                  paddingHorizontal: 20,
                  paddingTop: 12,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.bgMuted,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
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
                          paddingVertical: 16,
                          paddingHorizontal: 20,
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
                          <MaterialIcons
                            name={resolveIcon(item)}
                            size={20}
                            color={isSelected ? COLORS.bg : COLORS.text}
                          />
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 15,
                            fontWeight: isSelected ? '600' : '500',
                            color: COLORS.text,
                          }}
                          numberOfLines={1}
                        >
                          {item}
                        </Text>
                        {isSelected ? (
                          <MaterialIcons
                            name="check"
                            size={20}
                            color={COLORS.text}
                            style={{ marginLeft: 12 }}
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
