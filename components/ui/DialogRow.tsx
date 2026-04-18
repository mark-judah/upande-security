import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type Props = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value?: string | null;
};

export function DialogRow({ icon, label, value }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
      <MaterialIcons name={icon} size={18} color="#555" />
      <Text style={{ color: '#777', fontSize: 12, marginLeft: 8, width: 70 }}>{label}</Text>
      <Text style={{ color: '#111', fontSize: 14, flex: 1, fontWeight: '500' }}>
        {value ?? '—'}
      </Text>
    </View>
  );
}
