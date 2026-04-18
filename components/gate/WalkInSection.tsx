import { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type Props = {
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  children: ReactNode;
};

export function WalkInSection({ onClose, onSave, saving, children }: Props) {
  return (
    <View style={{ marginTop: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
        }}
      >
        <MaterialIcons name="person-add" size={20} color="#000000" />
        <Text
          style={{
            flex: 1,
            marginLeft: 8,
            fontSize: 15,
            fontWeight: '700',
            color: '#111111',
          }}
        >
          Register Walk-In Visitor
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.6}>
          <MaterialIcons name="close" size={20} color="#666666" />
        </TouchableOpacity>
      </View>
      <View style={{ height: 1, backgroundColor: '#E8E8E8', marginBottom: 10 }} />

      {children}

      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: '#000000',
          opacity: saving ? 0.6 : 1,
          borderRadius: 8,
          paddingVertical: 16,
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          marginTop: 4,
        }}
      >
        <MaterialIcons name="save" size={18} color="#FFFFFF" />
        <Text
          style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6, letterSpacing: 0.5 }}
        >
          SAVE & CHECK IN
        </Text>
      </TouchableOpacity>
    </View>
  );
}
