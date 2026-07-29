import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TransportMode } from '@/constants/transportModes';
import { fmtTime, getDuration } from '@/lib/utils/date';
import type { Attendance } from '@/lib/api/types';

type Props = { attendance: Attendance };

const TRANSPORT_ICON: Record<string, keyof typeof import('@expo/vector-icons').MaterialIcons.glyphMap> = {
  [TransportMode.OnFoot]: 'directions-walk',
  [TransportMode.Vehicle]: 'directions-car',
  [TransportMode.MotorBike]: 'two-wheeler',
};

function TransportPill({ mode, plate }: { mode?: string; plate?: string }) {
  const icon = (mode && TRANSPORT_ICON[mode]) || 'directions-walk';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEEEEE',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
        marginRight: 6,
      }}
    >
      <MaterialIcons name={icon} size={11} color="#333333" />
      <Text style={{ fontSize: 10, color: '#111111', fontWeight: '700', marginLeft: 3 }}>
        {mode ?? TransportMode.OnFoot}
        {plate ? ` · ${plate}` : ''}
      </Text>
    </View>
  );
}

function durationBetween(inIso?: string, outIso?: string): string {
  if (!inIso || !outIso) return '';
  const diff = new Date(outIso).getTime() - new Date(inIso).getTime();
  if (diff < 0) return '';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff / 60_000) % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function StaffAttendanceRow({ attendance: a }: Props) {
  const checkedOut = Boolean(a.out_time);
  const currentlyInside = Boolean(a.in_time) && !checkedOut;
  const steppedOut = currentlyInside && Boolean(a.custom_temp_exit_time);
  const bg = checkedOut ? '#F5F5F5' : currentlyInside ? '#FAFAFA' : '#FFFFFF';

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 10,
        borderLeftWidth: 3,
        borderLeftColor: currentlyInside ? '#43A047' : '#999999',
        borderWidth: 1,
        borderColor: '#E8E8E8',
        marginBottom: 8,
        padding: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MaterialIcons name="badge" size={18} color={currentlyInside ? '#43A047' : '#666666'} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontWeight: '700', color: '#111111' }} numberOfLines={1}>
            {a.employee_name ?? a.employee}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 4,
              flexWrap: 'wrap',
            }}
          >
            <TransportPill mode={a.custom_mode_of_transport} plate={a.custom_vehicle_number_plate} />
            <Text style={{ fontSize: 11, color: '#333333' }}>
              {a.in_time ? `In ${fmtTime(a.in_time)}` : '—'}
              {checkedOut ? ` → Out ${fmtTime(a.out_time)}` : ''}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 11, color: '#666666' }}>
              {checkedOut
                ? durationBetween(a.in_time, a.out_time)
                : currentlyInside
                  ? getDuration(a.in_time)
                  : ''}
            </Text>
            {steppedOut ? (
              <View
                style={{
                  marginLeft: 6,
                  backgroundColor: '#E65100',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>
                  STEPPED OUT
                </Text>
              </View>
            ) : currentlyInside ? (
              <View
                style={{
                  marginLeft: 6,
                  backgroundColor: '#000000',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>INSIDE</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
