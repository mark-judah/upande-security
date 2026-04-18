import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LiveTimer } from '@/components/ui/LiveTimer';
import { fmtTime } from '@/lib/utils/date';
import { WORKFLOW_META } from '@/constants/workflowStates';
import type { Appointment } from '@/lib/api/types';

type Props = { appointment: Appointment };

export function InsideCard({ appointment: a }: Props) {
  const checkInDate = a.custom_check_in_time ? new Date(a.custom_check_in_time) : null;
  const meta = WORKFLOW_META[a.workflow_state];

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#000000',
        shadowColor: '#000000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
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
    </View>
  );
}
