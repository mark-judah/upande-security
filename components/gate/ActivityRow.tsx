import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Collapsible from 'react-native-collapsible';
import { WORKFLOW_META } from '@/constants/workflowStates';
import { fmtTime, getDuration } from '@/lib/utils/date';
import { WorkflowTrail } from './WorkflowTrail';
import type { Appointment } from '@/lib/api/types';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';

type Props = { appointment: Appointment };

const VISITOR_TYPE_STYLE: Record<
  NonNullable<Appointment['custom_visitor_type']>,
  { bg: string; fg: string }
> = {
  Visitor: { bg: COLORS.info, fg: COLORS.textOnPrimary },
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

function PlatePill({ plate, colour }: { plate?: string; colour?: string }) {
  if (!plate) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgMuted,
        borderRadius: borderRadius.sm,
        paddingHorizontal: 5,
        paddingVertical: 2,
        marginRight: spacing.sm - 2,
      }}
    >
      <Ionicons name="car-outline" size={11} color={COLORS.textSecondary} />
      <Text style={{ fontSize: 10, color: COLORS.text, fontFamily: fontFamily.semiBold, marginLeft: 3 }}>
        {plate}
        {colour ? ` · ${colour}` : ''}
      </Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <View style={{ flexDirection: 'row', marginVertical: 2 }}>
      <Text style={{ width: 90, color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
        {label}
      </Text>
      <Text style={{ flex: 1, color: COLORS.text, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
        {String(value)}
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

export function ActivityRow({ appointment: a }: Props) {
  const [open, setOpen] = useState(false);
  const meta = WORKFLOW_META[a.workflow_state];
  const checkedIn = Boolean(a.custom_check_in_time);
  const checkedOut = Boolean(a.custom_check_out_time);
  const currentlyInside = checkedIn && !checkedOut;

  const bg = checkedOut ? COLORS.surfaceAlt : currentlyInside ? COLORS.bgMuted : COLORS.surface;

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.8}
        style={{ padding: spacing.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {meta ? (
            <Ionicons name={meta.icon} size={18} color={meta.color} />
          ) : null}
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <VisitorTypeBadge type={a.custom_visitor_type} />
              <Text
                style={{ fontFamily: fontFamily.semiBold, color: COLORS.text, flexShrink: 1 }}
                numberOfLines={1}
              >
                {a.customer_name}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 4,
                flexWrap: 'wrap',
              }}
            >
              <PlatePill
                plate={a.custom_vehicles_number_plate}
                colour={a.custom_vehicles_colour}
              />
              <Text style={{ fontSize: fontSize.xs, fontFamily: fontFamily.regular, color: meta?.color ?? COLORS.textMuted }}>
                {a.workflow_state}
              </Text>
              {a.custom_number_of_passengers ? (
                <Text style={{ fontSize: fontSize.xs, fontFamily: fontFamily.regular, color: COLORS.textSecondary, marginLeft: spacing.sm }}>
                  +{a.custom_number_of_passengers}
                </Text>
              ) : null}
              <View style={{ flex: 1 }} />
              <Text style={{ fontSize: fontSize.xs, fontFamily: fontFamily.regular, color: COLORS.textSecondary }}>
                {checkedIn ? `In ${fmtTime(a.custom_check_in_time)}` : '—'}
                {checkedOut ? ` → Out ${fmtTime(a.custom_check_out_time)}` : ''}
              </Text>
              {currentlyInside ? (
                <View
                  style={{
                    marginLeft: 6,
                    backgroundColor: COLORS.primary,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: borderRadius.sm,
                  }}
                >
                  <Text style={{ color: COLORS.textOnPrimary, fontSize: 9, fontFamily: fontFamily.bold }}>INSIDE</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Ionicons
            name={open ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={20}
            color={COLORS.textMuted}
            style={{ marginLeft: spacing.xs }}
          />
        </View>
      </TouchableOpacity>

      <Collapsible collapsed={!open}>
        <View style={{ padding: spacing.md, paddingTop: 0 }}>
          <View style={{ height: 1, backgroundColor: COLORS.border, marginBottom: spacing.sm }} />
          <DetailRow label="Visitor Type" value={a.custom_visitor_type} />
          <DetailRow label="Contractor" value={a.custom_contractor_ref} />
          <DetailRow label="Phone" value={a.customer_phone_number} />
          <DetailRow label="Host" value={a.host_name ?? a.custom_meet_with} />
          <DetailRow label="Transport" value={a.custom_mode_of_transport} />
          <DetailRow label="Vehicle" value={a.custom_vehicles_number_plate} />
          <DetailRow label="Colour" value={a.custom_vehicles_colour} />
          <DetailRow label="Passengers" value={a.custom_number_of_passengers ?? undefined} />
          <DetailRow label="Purpose" value={a.customer_details} />
          <DetailRow label="Check-in" value={fmtTime(a.custom_check_in_time)} />
          <DetailRow label="Check-out" value={fmtTime(a.custom_check_out_time)} />
          <DetailRow
            label="Duration"
            value={
              checkedOut
                ? durationBetween(a.custom_check_in_time, a.custom_check_out_time)
                : checkedIn
                  ? getDuration(a.custom_check_in_time)
                  : undefined
            }
          />
          <WorkflowTrail appointment={a} />
        </View>
      </Collapsible>
    </View>
  );
}
