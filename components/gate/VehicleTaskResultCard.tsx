import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  GateVerificationStatus,
  VehicleMovementType,
  VehicleTaskLeg,
  VehicleTaskSearchHit,
} from '@/lib/services/api';
import { fmtDateTime } from '@/lib/utils/date';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  result: VehicleTaskSearchHit;
  onDecide: (
    movement: VehicleMovementType,
    status: GateVerificationStatus,
    remarks: string,
  ) => void;
  busy?: boolean;
  onReset: () => void;
};

/** A leg still waiting on its entry scan — what an Entry here would close. */
function openLeg(legs: VehicleTaskLeg[]): VehicleTaskLeg | undefined {
  return legs.find((l) => l.gate_exit_time && !l.gate_entry_time);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginTop: 6 }}>
      <Text
        style={{
          width: 96,
          color: COLORS.textMuted,
          fontSize: fontSize.xs,
          fontFamily: fontFamily.regular,
        }}
      >
        {label}
      </Text>
      <Text
        style={{ flex: 1, color: COLORS.text, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Shows the matched vehicle task and takes the guard's decision. The
 * movement direction is the guard's call — the server opens a new leg on
 * Exit and closes the open one on Entry — so it is picked explicitly here
 * rather than inferred, and defaults to whichever one the vehicle's own
 * history implies.
 */
export function VehicleTaskResultCard({ result, onDecide, busy, onReset }: Props) {
  const legs = result.recent_legs || [];
  const open = openLeg(legs);
  // Out on a leg already -> the next scan is almost always the return.
  const [movement, setMovement] = useState<VehicleMovementType>(open ? 'Entry' : 'Exit');
  const [remarks, setRemarks] = useState('');

  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        marginVertical: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="car-outline" size={22} color={COLORS.text} />
        <Text
          style={{
            marginLeft: 10,
            flex: 1,
            fontFamily: fontFamily.bold,
            fontSize: fontSize.md,
            color: COLORS.text,
          }}
        >
          {result.vehicle_no || result.reference_name}
        </Text>
      </View>

      {!result.is_authorized ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFBEB',
            borderRadius: borderRadius.sm,
            padding: 10,
            marginTop: spacing.sm,
          }}
        >
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.warn} />
          <Text
            style={{
              marginLeft: 8,
              flex: 1,
              color: COLORS.warn,
              fontSize: fontSize.xs,
              fontFamily: fontFamily.semiBold,
            }}
          >
            Task status is {result.source_status || 'not set'} — not an authorised status
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.sm }}>
        <Row label="Task" value={result.reference_name} />
        {result.task_description ? <Row label="Doing" value={result.task_description} /> : null}
        {result.source_status ? <Row label="Status" value={result.source_status} /> : null}
      </View>

      {open ? (
        <View
          style={{
            backgroundColor: COLORS.surfaceAlt,
            borderRadius: borderRadius.sm,
            padding: 10,
            marginTop: spacing.md,
          }}
        >
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
            Currently out — left {open.from_farm || 'a farm'}
            {open.gate_exit_time ? ` at ${fmtDateTime(open.gate_exit_time)}` : ''}. An entry closes
            that trip.
          </Text>
        </View>
      ) : null}

      <Text
        style={{
          marginTop: spacing.md,
          marginBottom: 6,
          color: COLORS.textMuted,
          fontSize: fontSize.xs,
          fontFamily: fontFamily.semiBold,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        Direction
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {(['Exit', 'Entry'] as VehicleMovementType[]).map((m) => {
          const active = movement === m;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => setMovement(m)}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: active ? COLORS.primary : COLORS.border,
                backgroundColor: active ? COLORS.primary : 'transparent',
                borderRadius: borderRadius.md,
                paddingVertical: spacing.md,
                minHeight: 46,
              }}
            >
              <Ionicons
                name={m === 'Exit' ? 'exit-outline' : 'enter-outline'}
                size={18}
                color={active ? COLORS.textOnPrimary : COLORS.text}
              />
              <Text
                style={{
                  marginLeft: 8,
                  color: active ? COLORS.textOnPrimary : COLORS.text,
                  fontFamily: fontFamily.semiBold,
                  fontSize: fontSize.sm,
                }}
              >
                {m === 'Exit' ? 'Leaving' : 'Returning'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TextInput
        value={remarks}
        onChangeText={setRemarks}
        placeholder="Remarks (optional)"
        placeholderTextColor={COLORS.textMuted}
        editable={!busy}
        multiline
        style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          marginTop: spacing.md,
          minHeight: 44,
          fontSize: fontSize.sm,
          color: COLORS.text,
          backgroundColor: COLORS.surface,
        }}
      />

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <TouchableOpacity
          onPress={() => onDecide(movement, 'Rejected', remarks)}
          disabled={busy}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: COLORS.danger,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.md,
            minHeight: 46,
          }}
        >
          <Text style={{ color: COLORS.danger, fontFamily: fontFamily.semiBold }}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDecide(movement, 'Verified', remarks)}
          disabled={busy}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: COLORS.success,
            opacity: busy ? 0.6 : 1,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.md,
            minHeight: 46,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
          ) : (
            <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold }}>
              Verify {movement.toLowerCase()}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={onReset}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          marginTop: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.sm,
          minHeight: 36,
        }}
      >
        <Text style={{ color: COLORS.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
          Cancel
        </Text>
      </TouchableOpacity>

      {legs.length ? (
        <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: spacing.sm }}>
          <Text
            style={{
              color: COLORS.textMuted,
              fontSize: fontSize.xs,
              fontFamily: fontFamily.semiBold,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginBottom: 4,
            }}
          >
            Recent trips
          </Text>
          {legs.slice(0, 5).map((l) => (
            <Text
              key={l.name}
              style={{
                color: COLORS.textSecondary,
                fontSize: fontSize.xs,
                fontFamily: fontFamily.regular,
                marginTop: 4,
              }}
            >
              {l.from_farm || '—'}
              {l.gate_exit_time ? ` ${fmtDateTime(l.gate_exit_time)}` : ''} →{' '}
              {l.gate_entry_time ? `${l.to_farm || '—'} ${fmtDateTime(l.gate_entry_time)}` : 'still out'}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
