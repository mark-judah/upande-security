import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LiveTimer } from '@/components/ui/LiveTimer';
import { fmtTime } from '@/lib/utils/date';
import { WORKFLOW_META } from '@/constants/workflowStates';
import type { Appointment } from '@/lib/api/types';

type Props = {
  appointment: Appointment;
  onCheckOut?: (name: string) => void;
  busy?: boolean;
};

export function InsideCard({ appointment: a, onCheckOut, busy }: Props) {
  const checkInDate = a.custom_check_in_time ? new Date(a.custom_check_in_time) : null;
  const meta = WORKFLOW_META[a.workflow_state];

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E8E8E8',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MaterialIcons name="person-pin" size={20} color="#000000" />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontWeight: '700', color: '#111111' }}>{a.customer_name}</Text>
          {a.customer_phone_number ? (
            <Text style={{ color: '#666666', fontSize: 12 }}>{a.customer_phone_number}</Text>
          ) : null}
        </View>
        {checkInDate ? <LiveTimer entryTime={checkInDate} compact /> : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 8,
          flexWrap: 'wrap',
        }}
      >
        {meta ? (
          <>
            <MaterialIcons
              name={meta.icon as keyof typeof import('@expo/vector-icons').MaterialIcons.glyphMap}
              size={14}
              color={meta.color}
            />
            <Text style={{ color: meta.color, fontSize: 12, marginLeft: 4, marginRight: 10 }}>
              {a.workflow_state}
            </Text>
          </>
        ) : null}
        {checkInDate ? (
          <Text style={{ color: '#666666', fontSize: 12, marginRight: 10 }}>
            In {fmtTime(a.custom_check_in_time)}
          </Text>
        ) : null}
        {a.custom_mode_of_transport ? (
          <Text style={{ color: '#666666', fontSize: 12, marginRight: 10 }}>
            {a.custom_mode_of_transport}
          </Text>
        ) : null}
        {a.custom_number_of_passengers ? (
          <Text style={{ color: '#333333', fontSize: 12 }}>
            +{a.custom_number_of_passengers} pax
          </Text>
        ) : null}
      </View>

      {onCheckOut ? (
        <TouchableOpacity
          onPress={() => onCheckOut(a.name)}
          disabled={busy}
          activeOpacity={0.8}
          style={{
            marginTop: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: busy ? '#E0E0E0' : '#000000',
            borderRadius: 6,
            paddingVertical: 10,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#666666" />
          ) : (
            <>
              <MaterialIcons name="logout" size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13, marginLeft: 6 }}>
                CHECK OUT
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
