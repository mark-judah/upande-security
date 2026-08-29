import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DialogRow } from '@/components/ui/DialogRow';
import { GatePicker } from '@/components/gate/GatePicker';
import type { TractorDailyTask } from '@/lib/api/types';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

type Props = {
  visible: boolean;
  ticket: TractorDailyTask | null;
  entryGate: string | null;
  onEntryGateChange: (gate: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
};

export function VehicleEntryDialog({
  visible,
  ticket,
  entryGate,
  onEntryGateChange,
  onCancel,
  onConfirm,
  busy,
}: Props) {
  if (!ticket) return null;

  const activities = Array.from(new Set((ticket.task ?? []).map((t) => t.activity_type))).filter(
    Boolean,
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.overlay,
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
        }}
      >
        <View style={{ backgroundColor: COLORS.surface, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 14,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
            }}
          >
            <Ionicons name="leaf-outline" size={22} color={COLORS.text} />
            <Text style={{ fontSize: 16, fontWeight: '700', marginLeft: spacing.sm, color: COLORS.text }}>
              Confirm Vehicle Entry
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 14 }}>
            <DialogRow icon="car" label="Vehicle" value={ticket.motor_vehicle} />
            <DialogRow icon="location" label="Farm" value={ticket.farm} />
            <DialogRow icon="person" label="Operator" value={ticket.operator} />
            <DialogRow
              icon="checkmark-done-circle-outline"
              label="Activity"
              value={activities.length ? activities.join(', ') : '—'}
            />
            {ticket.task?.[0]?.description ? (
              <DialogRow
                icon="document-text-outline"
                label="Details"
                value={ticket.task[0].description}
              />
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: COLORS.surfaceAlt,
                borderRadius: borderRadius.md,
                padding: 10,
                marginTop: spacing.md,
              }}
            >
              <Ionicons name="timer-outline" size={18} color={COLORS.text} />
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs, marginLeft: spacing.sm, flex: 1 }}>
                Timer starts on entry. Time is recorded to the timesheet when the vehicle exits.
              </Text>
            </View>

            <GatePicker
              farm={ticket.farm}
              value={entryGate}
              onChange={onEntryGateChange}
              label="Entry Gate"
            />
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              padding: 10,
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
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
              <Text style={{ color: COLORS.textMuted, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={{
                flex: 2,
                backgroundColor: COLORS.primary,
                opacity: busy ? 0.6 : 1,
                borderRadius: borderRadius.md,
                paddingVertical: 14,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                marginLeft: spacing.sm,
              }}
            >
              <Ionicons name="log-in-outline" size={18} color={COLORS.textOnPrimary} />
              <Text
                style={{
                  color: COLORS.textOnPrimary,
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
