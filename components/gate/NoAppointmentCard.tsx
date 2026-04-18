import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type Props = {
  onRegisterAsWalkIn: () => void;
};

export function NoAppointmentCard({ onRegisterAsWalkIn }: Props) {
  return (
    <View
      style={{
        backgroundColor: '#F5F5F5',
        borderLeftWidth: 4,
        borderLeftColor: '#000000',
        borderRadius: 10,
        padding: 14,
        marginVertical: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <MaterialIcons name="info" size={22} color="#000000" />
        <Text style={{ color: '#000000', fontWeight: '700', marginLeft: 8 }}>
          NO APPOINTMENT FOUND
        </Text>
      </View>
      <TouchableOpacity
        onPress={onRegisterAsWalkIn}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: '#000000',
          borderRadius: 8,
          paddingVertical: 14,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.5 }}>
          REGISTER AS WALK-IN
        </Text>
      </TouchableOpacity>
    </View>
  );
}
