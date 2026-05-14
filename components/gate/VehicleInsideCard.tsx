import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { fmtDateTime } from '@/lib/utils/date';
import type { ActiveVehicleEntry } from '@/lib/stores/vehicleStore';

type Props = {
  entry: ActiveVehicleEntry;
  onCheckOut: (entry: ActiveVehicleEntry, completionNote: string) => void;
  busy?: boolean;
};

export function VehicleInsideCard({ entry, onCheckOut, busy }: Props) {
  const [note, setNote] = useState('');
  const { ticketData: ticket, timesheetName, entryTime } = entry;

  const activities = Array.from(
    new Set((ticket.task ?? []).map((t) => t.activity_type)),
  ).filter(Boolean);

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#000000',
        padding: 14,
        marginTop: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: '#F5F5F5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name="agriculture" size={22} color="#000000" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: '#111111' }}>
            {ticket.motor_vehicle ?? ticket.name}
          </Text>
          {ticket.farm ? (
            <Text style={{ color: '#666666', fontSize: 12 }}>{ticket.farm}</Text>
          ) : null}
        </View>
        <View
          style={{
            backgroundColor: '#000000',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
            INSIDE
          </Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: '#E8E8E8', marginVertical: 10 }} />

      <Text style={{ color: '#999999', fontSize: 11, marginBottom: 2 }}>TICKET</Text>
      <Text style={{ color: '#333333', fontSize: 13, marginBottom: 8 }}>{ticket.name}</Text>

      <Text style={{ color: '#999999', fontSize: 11, marginBottom: 2 }}>TIMESHEET</Text>
      <Text style={{ color: '#333333', fontSize: 13, marginBottom: 8 }}>
        {timesheetName}
      </Text>

      {activities.length ? (
        <>
          <Text style={{ color: '#999999', fontSize: 11, marginBottom: 2 }}>ACTIVITY</Text>
          <Text style={{ color: '#333333', fontSize: 13, marginBottom: 8 }}>
            {activities.join(', ')}
          </Text>
        </>
      ) : null}

      {entry.description ? (
        <>
          <Text style={{ color: '#999999', fontSize: 11, marginBottom: 2 }}>DETAILS</Text>
          <Text style={{ color: '#333333', fontSize: 13, marginBottom: 8 }}>
            {entry.description}
          </Text>
        </>
      ) : null}

      <View
        style={{
          backgroundColor: '#F5F5F5',
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 6,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: '#111111', fontSize: 12, fontWeight: '600' }}>
          Entered at {fmtDateTime(entryTime)}
        </Text>
      </View>

      <Text style={{ fontSize: 13, color: '#555555', marginBottom: 4, fontWeight: '600' }}>
        Completion Note *
      </Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Avocado transportation — 54ha covered"
        placeholderTextColor="#A0A0A0"
        multiline
        numberOfLines={2}
        editable={!busy}
        style={{
          borderWidth: 1,
          borderColor: '#D0D0D0',
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          minHeight: 60,
          textAlignVertical: 'top',
          fontSize: 14,
          color: '#111111',
          backgroundColor: '#FFFFFF',
          marginBottom: 12,
        }}
      />

      <TouchableOpacity
        onPress={() => onCheckOut(entry, note.trim())}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 2,
          borderColor: '#000000',
          opacity: busy ? 0.6 : 1,
          borderRadius: 10,
          paddingVertical: 14,
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}
      >
        <MaterialIcons name="logout" size={20} color="#000000" />
        <Text
          style={{ color: '#000000', fontWeight: '700', marginLeft: 8, letterSpacing: 0.5 }}
        >
          TASK COMPLETE — CHECK OUT
        </Text>
      </TouchableOpacity>
    </View>
  );
}
