import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type Props = {
  label: string;
  value: number;
  color: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

export function StatCard({ label, value, color, icon }: Props) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <MaterialIcons name={icon} size={28} color={color} />
      <Text style={{ fontSize: 28, fontWeight: '700', color, marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{label}</Text>
    </View>
  );
}
