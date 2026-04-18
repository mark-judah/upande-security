import { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

type Props = {
  label?: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  error?: string;
};

export function FormSelect({ label, value, options, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? (
        <Text style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{label}</Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: error ? theme.error : '#D0D0D0',
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 12,
          backgroundColor: 'white',
        }}
      >
        <Text style={{ fontSize: 15, color: value ? '#111' : '#A0A0A0' }}>
          {value || 'Select…'}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={22} color="#666" />
      </Pressable>
      {error ? (
        <Text style={{ color: theme.error, fontSize: 12, marginTop: 4 }}>{error}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              overflow: 'hidden',
              maxHeight: 360,
            }}
          >
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: pressed ? '#F0F0F0' : 'white',
                    flexDirection: 'row',
                    alignItems: 'center',
                  })}
                >
                  <Text style={{ fontSize: 15, flex: 1 }}>{item}</Text>
                  {value === item ? (
                    <MaterialIcons name="check" size={18} color={theme.primaryColor} />
                  ) : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
