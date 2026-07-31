import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LiveTimer } from '@/components/ui/LiveTimer';
import { fmtTime, getDuration } from '@/lib/utils/date';
import { WORKFLOW_META } from '@/constants/workflowStates';
import { useAppointmentTempExit } from '@/lib/hooks/useAppointmentTempExit';
import type { Appointment } from '@/lib/api/types';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';

type Props = {
  appointment: Appointment;
  onCheckOut?: (name: string) => void;
  busy?: boolean;
};

const VISITOR_TYPE_STYLE: Record<
  NonNullable<Appointment['custom_visitor_type']>,
  { bg: string; fg: string }
> = {
  Visitor: { bg: COLORS.primary, fg: COLORS.textOnPrimary },
  Staff: { bg: COLORS.success, fg: COLORS.textOnPrimary },
  Contractor: { bg: COLORS.warn, fg: COLORS.textOnPrimary },
  Customer: { bg: '#8E24AA', fg: COLORS.textOnPrimary },
};

function VisitorTypeBadge({ type }: { type?: Appointment['custom_visitor_type'] }) {
  const resolved = type ?? 'Visitor';
  const palette = VISITOR_TYPE_STYLE[resolved] ?? VISITOR_TYPE_STYLE.Visitor;
  return (
    <View
      style={{
        backgroundColor: palette.bg,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
        marginRight: spacing.sm - 2,
      }}
    >
      <Text style={{ color: palette.fg, fontSize: 9, fontFamily: fontFamily.bold, letterSpacing: 0.5 }}>
        {resolved.toUpperCase()}
      </Text>
    </View>
  );
}

export function InsideCard({ appointment: a, onCheckOut, busy }: Props) {
  const checkInDate = a.custom_check_in_time ? new Date(a.custom_check_in_time) : null;
  const meta = WORKFLOW_META[a.workflow_state];
  const isContractor = a.custom_visitor_type === 'Contractor';

  const tempExit = useAppointmentTempExit();
  const steppedOut = Boolean(a.custom_temp_exit_time);

  async function handleTempExit() {
    await tempExit.mutateAsync({ name: a.name, direction: steppedOut ? 'in' : 'out' });
  }

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
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="person" size={20} color={COLORS.text} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <VisitorTypeBadge type={a.custom_visitor_type} />
            <Text
              style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text, flexShrink: 1 }}
              numberOfLines={1}
            >
              {a.customer_name}
            </Text>
          </View>
          {a.customer_phone_number ? (
            <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
              {a.customer_phone_number}
            </Text>
          ) : null}
          {isContractor && a.custom_contractor_ref ? (
            <Text style={{ color: COLORS.warn, fontSize: 11, fontFamily: fontFamily.semiBold }}>
              {a.custom_contractor_ref}
            </Text>
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
            <Text style={{ color: meta.color, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginLeft: spacing.xs, marginRight: 10 }}>
              {a.workflow_state}
            </Text>
          </>
        ) : null}
        {checkInDate ? (
          <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginRight: 10 }}>
            In {fmtTime(a.custom_check_in_time)}
          </Text>
        ) : null}
        {a.custom_mode_of_transport ? (
          <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginRight: 10 }}>
            {a.custom_mode_of_transport}
          </Text>
        ) : null}
        {a.custom_vehicles_number_plate ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: COLORS.bgMuted,
              borderRadius: borderRadius.sm,
              paddingHorizontal: 5,
              paddingVertical: 2,
              marginRight: 10,
            }}
          >
            <Ionicons name="car-outline" size={11} color={COLORS.textSecondary} />
            <Text style={{ fontSize: 11, color: COLORS.text, fontFamily: fontFamily.semiBold, marginLeft: 3 }}>
              {a.custom_vehicles_number_plate}
              {a.custom_vehicles_colour ? ` · ${a.custom_vehicles_colour}` : ''}
            </Text>
          </View>
        ) : null}
        {a.custom_number_of_passengers ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
            +{a.custom_number_of_passengers} pax
          </Text>
        ) : null}
      </View>

      {steppedOut ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFBEB',
            borderRadius: borderRadius.sm,
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: spacing.sm - 2,
            marginTop: spacing.sm,
          }}
        >
          <Ionicons name="walk-outline" size={14} color={COLORS.warn} />
          <Text style={{ color: COLORS.warn, fontSize: fontSize.xs, fontFamily: fontFamily.semiBold, marginLeft: spacing.sm - 2 }}>
            Stepped out at {fmtTime(a.custom_temp_exit_time)} ·{' '}
            {getDuration(a.custom_temp_exit_time)}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm + 2 }}>
        <TouchableOpacity
          onPress={handleTempExit}
          disabled={tempExit.isPending}
          activeOpacity={0.8}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: steppedOut ? COLORS.success : COLORS.warn,
            borderRadius: borderRadius.sm,
            paddingVertical: spacing.sm + 2,
            opacity: tempExit.isPending ? 0.6 : 1,
            minHeight: 40,
          }}
        >
          {tempExit.isPending ? (
            <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
          ) : (
            <>
              <Ionicons name={steppedOut ? 'log-in-outline' : 'walk-outline'} size={16} color={COLORS.textOnPrimary} />
              <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, marginLeft: spacing.sm - 2, fontSize: fontSize.sm }}>
                {steppedOut ? 'CONFIRM RETURN' : 'STEP OUT'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {onCheckOut ? (
          <TouchableOpacity
            onPress={() => onCheckOut(a.name)}
            disabled={busy}
            activeOpacity={0.8}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: busy ? COLORS.border : COLORS.primary,
              borderRadius: borderRadius.sm,
              paddingVertical: spacing.sm + 2,
              minHeight: 40,
            }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.textMuted} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={16} color={COLORS.textOnPrimary} />
                <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, marginLeft: spacing.sm - 2 }}>
                  CHECK OUT
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
