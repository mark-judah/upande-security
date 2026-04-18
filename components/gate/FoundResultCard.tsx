import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { VisitorAppointmentSearchResult } from '@/lib/api/types';
import { StatusChip } from '@/components/ui/StatusChip';

type Props = {
  result: VisitorAppointmentSearchResult;
  onProceed: () => void;
  onRegisterAsWalkIn: () => void;
};

export function FoundResultCard({ result, onProceed, onRegisterAsWalkIn }: Props) {
  return (
    <View>
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
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <MaterialIcons name="event-available" size={22} color="#000000" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111111', flex: 1 }}>
                {result.visitor_name ?? '—'}
              </Text>
              {result.status ? <StatusChip state={result.status} compact /> : null}
            </View>
            {result.phone_number ? (
              <Text style={{ color: '#333333', fontSize: 13 }}>Phone: {result.phone_number}</Text>
            ) : null}
            {result.host_name ? (
              <Text style={{ color: '#333333', fontSize: 13 }}>Visiting: {result.host_name}</Text>
            ) : null}
            {result.scheduled_time ? (
              <Text style={{ color: '#333333', fontSize: 13 }}>
                Scheduled: {result.scheduled_time}
              </Text>
            ) : null}
            {result.purpose ? (
              <Text style={{ color: '#333333', fontSize: 13 }}>Purpose: {result.purpose}</Text>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          onPress={onProceed}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            backgroundColor: '#000000',
            borderRadius: 8,
            paddingVertical: 14,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 12,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.5 }}>PROCEED</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={onRegisterAsWalkIn}
        activeOpacity={0.7}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
        }}
      >
        <MaterialIcons name="person-add" size={16} color="#000000" />
        <Text style={{ color: '#000000', fontSize: 13, marginLeft: 4, fontWeight: '600' }}>
          Different visit? Register as new walk-in
        </Text>
      </TouchableOpacity>
    </View>
  );
}
