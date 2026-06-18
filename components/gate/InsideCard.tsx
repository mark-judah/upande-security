import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LiveTimer } from '@/components/ui/LiveTimer';
import { fmtTime } from '@/lib/utils/date';
import { WORKFLOW_META } from '@/constants/workflowStates';
import type { Appointment } from '@/lib/api/types';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

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
        backgroundColor: COLORS.surface,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="person" size={20} color={COLORS.text} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={{ fontWeight: '700', color: COLORS.text }}>{a.customer_name}</Text>
          {a.customer_phone_number ? (
            <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs }}>{a.customer_phone_number}</Text>
          ) : null}
        </View>
        {checkInDate ? <LiveTimer entryTime={checkInDate} compact /> : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.sm,
          flexWrap: 'wrap',
        }}
      >
        {meta ? (
          <>
            <Ionicons name={meta.icon} size={14} color={meta.color} />
            <Text style={{ color: meta.color, fontSize: fontSize.xs, marginLeft: spacing.xs, marginRight: 10 }}>
              {a.workflow_state}
            </Text>
          </>
        ) : null}
        {checkInDate ? (
          <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginRight: 10 }}>
            In {fmtTime(a.custom_check_in_time)}
          </Text>
        ) : null}
        {a.custom_mode_of_transport ? (
          <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginRight: 10 }}>
            {a.custom_mode_of_transport}
          </Text>
        ) : null}
        {a.custom_number_of_passengers ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs }}>
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
            backgroundColor: busy ? COLORS.border : COLORS.primary,
            borderRadius: borderRadius.sm,
            paddingVertical: 10,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={COLORS.textMuted} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={16} color={COLORS.textOnPrimary} />
              <Text style={{ color: COLORS.textOnPrimary, fontWeight: '700', fontSize: fontSize.sm, marginLeft: 6 }}>
                CHECK OUT
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
