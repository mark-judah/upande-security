import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LiveTimer } from '@/components/ui/LiveTimer';
import { fmtDateTime } from '@/lib/utils/date';
import type { TractorDailyTask } from '@/lib/api/types';

type Props = {
  ticket: TractorDailyTask;
  entryTime: Date;
  onCheckOut: (completionNote: string) => void;
  busy?: boolean;
};

export function VehicleInsideCard({ ticket, entryTime, onCheckOut, busy }: Props) {
  const [note, setNote] = useState('');

  const activities = Array.from(new Set((ticket.task ?? []).map((t) => t.activity_type))).filter(
    Boolean,
  );

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
          <Text style={{ fontWeight: '700', fontSize: 15, color: '#111111' }}>
            {ticket.motor_vehicle ?? '—'}
          </Text>
          {ticket.farm ? (
            <Text style={{ color: '#666666', fontSize: 12 }}>{ticket.farm}</Text>
          ) : null}
        </View>
        <LiveTimer entryTime={entryTime} />
      </View>

      <View style={{ height: 1, backgroundColor: '#E8E8E8', marginVertical: 10 }} />

      {activities.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <MaterialIcons name="task-alt" size={16} color="#555555" />
          <Text style={{ color: '#333333', fontSize: 13, marginLeft: 6, flex: 1 }}>
            {activities.join(', ')}
          </Text>
        </View>
      ) : null}

      <View
        style={{
          backgroundColor: '#F5F5F5',
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 6,
          marginBottom: 10,
        }}
      >
        <Text style={{ color: '#111111', fontSize: 12, fontWeight: '600' }}>
          Entered at {fmtDateTime(entryTime.toISOString())}
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
        onPress={() => onCheckOut(note.trim())}
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
