import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fmtDateTime } from '@/lib/utils/date';
import type { ActiveVehicleEntry } from '@/lib/stores/vehicleStore';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

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
        backgroundColor: COLORS.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        padding: 14,
        marginTop: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: COLORS.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="leaf-outline" size={22} color={COLORS.text} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: COLORS.text }}>
            {ticket.motor_vehicle ?? ticket.name}
          </Text>
          {ticket.farm ? (
            <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs }}>{ticket.farm}</Text>
          ) : null}
        </View>
        <View
          style={{
            backgroundColor: COLORS.primary,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: borderRadius.full,
          }}
        >
          <Text style={{ color: COLORS.textOnPrimary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
            INSIDE
          </Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 10 }} />

      <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginBottom: 2 }}>TICKET</Text>
      <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.sm }}>{ticket.name}</Text>

      <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginBottom: 2 }}>TIMESHEET</Text>
      <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.sm }}>
        {timesheetName}
      </Text>

      {activities.length ? (
        <>
          <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginBottom: 2 }}>ACTIVITY</Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.sm }}>
            {activities.join(', ')}
          </Text>
        </>
      ) : null}

      {entry.description ? (
        <>
          <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginBottom: 2 }}>DETAILS</Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.sm }}>
            {entry.description}
          </Text>
        </>
      ) : null}

      <View
        style={{
          backgroundColor: COLORS.surfaceAlt,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: borderRadius.sm,
          marginBottom: spacing.md,
        }}
      >
        <Text style={{ color: COLORS.text, fontSize: fontSize.xs, fontWeight: '600' }}>
          Entered at {fmtDateTime(entryTime)}
        </Text>
      </View>

      <Text style={{ fontSize: fontSize.sm, color: COLORS.textSecondary, marginBottom: spacing.xs, fontWeight: '600' }}>
        Completion Note *
      </Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Avocado transportation — 54ha covered"
        placeholderTextColor={COLORS.textMuted}
        multiline
        numberOfLines={2}
        editable={!busy}
        style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          minHeight: 60,
          textAlignVertical: 'top',
          fontSize: 14,
          color: COLORS.text,
          backgroundColor: COLORS.surface,
          marginBottom: spacing.md,
        }}
      />

      <TouchableOpacity
        onPress={() => onCheckOut(entry, note.trim())}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: COLORS.surface,
          borderWidth: 2,
          borderColor: COLORS.primary,
          opacity: busy ? 0.6 : 1,
          borderRadius: borderRadius.md,
          paddingVertical: 14,
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}
      >
        <Ionicons name="log-out-outline" size={20} color={COLORS.primary} />
        <Text
          style={{ color: COLORS.primary, fontWeight: '700', marginLeft: spacing.sm, letterSpacing: 0.5 }}
        >
          TASK COMPLETE — CHECK OUT
        </Text>
      </TouchableOpacity>
    </View>
  );
}
