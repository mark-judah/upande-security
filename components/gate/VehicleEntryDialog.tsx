import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DialogRow } from '@/components/ui/DialogRow';
import type { TractorDailyTask } from '@/lib/api/types';

type Props = {
  visible: boolean;
  ticket: TractorDailyTask | null;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
};

export function VehicleEntryDialog({ visible, ticket, onCancel, onConfirm, busy }: Props) {
  if (!ticket) return null;

  const activities = Array.from(new Set((ticket.task ?? []).map((t) => t.activity_type))).filter(
    Boolean,
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#E8E8E8',
            }}
          >
            <MaterialIcons name="agriculture" size={22} color="#000000" />
            <Text style={{ fontSize: 16, fontWeight: '700', marginLeft: 8, color: '#111111' }}>
              Confirm Vehicle Entry
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ padding: 14 }}>
            <DialogRow icon="directions-car" label="Vehicle" value={ticket.motor_vehicle} />
            <DialogRow icon="place" label="Farm" value={ticket.farm} />
            <DialogRow icon="person" label="Operator" value={ticket.operator} />
            <DialogRow
              icon="task-alt"
              label="Activity"
              value={activities.length ? activities.join(', ') : '—'}
            />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F5F5F5',
                borderRadius: 8,
                padding: 10,
                marginTop: 12,
              }}
            >
              <MaterialIcons name="timer" size={18} color="#000000" />
              <Text style={{ color: '#333333', fontSize: 12, marginLeft: 8, flex: 1 }}>
                Timer starts on entry. Time is recorded to the timesheet when the vehicle exits.
              </Text>
            </View>
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              padding: 10,
              borderTopWidth: 1,
              borderTopColor: '#E8E8E8',
            }}
          >
            <TouchableOpacity
              onPress={onCancel}
              disabled={busy}
              activeOpacity={0.6}
              style={{
                flex: 1,
                paddingVertical: 14,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#666666', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={{
                flex: 2,
                backgroundColor: '#000000',
                opacity: busy ? 0.6 : 1,
                borderRadius: 8,
                paddingVertical: 14,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                marginLeft: 8,
              }}
            >
              <MaterialIcons name="login" size={18} color="#FFFFFF" />
              <Text
                style={{
                  color: '#FFFFFF',
                  fontWeight: '700',
                  marginLeft: 6,
                  letterSpacing: 0.5,
                }}
              >
                CONFIRM ENTRY
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
