import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LiveTimer } from '@/components/ui/LiveTimer';
import { fmtTime, getDuration } from '@/lib/utils/date';
import { WORKFLOW_META } from '@/constants/workflowStates';
import { useAppointmentTempExit } from '@/lib/hooks/useAppointmentTempExit';
import type { Appointment } from '@/lib/api/types';
import { COLORS, spacing, borderRadius, fontSize } from '@/src/core/theme';

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
  Staff: { bg: '#43A047', fg: '#FFFFFF' },
  Contractor: { bg: '#FB8C00', fg: '#FFFFFF' },
  Customer: { bg: '#8E24AA', fg: '#FFFFFF' },
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
        borderRadius: 4,
        marginRight: 6,
      }}
    >
      <Text style={{ color: palette.fg, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
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
            <Text style={{ fontWeight: '700', color: COLORS.text, flexShrink: 1 }} numberOfLines={1}>
              {a.customer_name}
            </Text>
          </View>
          {a.customer_phone_number ? (
            <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs }}>{a.customer_phone_number}</Text>
          ) : null}
          {isContractor && a.custom_contractor_ref ? (
            <Text style={{ color: '#FB8C00', fontSize: 11, fontWeight: '600' }}>
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
        {a.custom_vehicles_number_plate ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#EEEEEE',
              borderRadius: 4,
              paddingHorizontal: 5,
              paddingVertical: 2,
              marginRight: 10,
            }}
          >
            <Ionicons name="car-outline" size={11} color="#333333" />
            <Text style={{ fontSize: 11, color: '#111111', fontWeight: '700', marginLeft: 3 }}>
              {a.custom_vehicles_number_plate}
              {a.custom_vehicles_colour ? ` · ${a.custom_vehicles_colour}` : ''}
            </Text>
          </View>
        ) : null}
        {a.custom_number_of_passengers ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs }}>
            +{a.custom_number_of_passengers} pax
          </Text>
        ) : null}
      </View>

      {steppedOut ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFF3E0',
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            marginTop: 8,
          }}
        >
          <Ionicons name="walk-outline" size={14} color="#E65100" />
          <Text style={{ color: '#E65100', fontSize: 12, fontWeight: '600', marginLeft: 6 }}>
            Stepped out at {fmtTime(a.custom_temp_exit_time)} ·{' '}
            {getDuration(a.custom_temp_exit_time)}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TouchableOpacity
          onPress={handleTempExit}
          disabled={tempExit.isPending}
          activeOpacity={0.8}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: steppedOut ? '#2E7D32' : '#EF6C00',
            borderRadius: borderRadius.sm,
            paddingVertical: 10,
            opacity: tempExit.isPending ? 0.6 : 1,
            minHeight: 40,
          }}
        >
          {tempExit.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name={steppedOut ? 'log-in-outline' : 'walk-outline'} size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6, fontSize: 13 }}>
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
              paddingVertical: 10,
              minHeight: 40,
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
    </View>
  );
}
