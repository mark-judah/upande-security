import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Collapsible from 'react-native-collapsible';
import { WORKFLOW_META } from '@/constants/workflowStates';
import { fmtTime, getDuration } from '@/lib/utils/date';
import { WorkflowTrail } from './WorkflowTrail';
import type { Appointment } from '@/lib/api/types';

type Props = { appointment: Appointment };

const VISITOR_TYPE_STYLE: Record<
  NonNullable<Appointment['custom_visitor_type']>,
  { bg: string; fg: string }
> = {
  Visitor: { bg: '#1E88E5', fg: '#FFFFFF' },
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

function PlatePill({ plate, colour }: { plate?: string; colour?: string }) {
  if (!plate) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEEEEE',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
        marginRight: 6,
      }}
    >
      <MaterialIcons name="directions-car" size={11} color="#333333" />
      <Text style={{ fontSize: 10, color: '#111111', fontWeight: '700', marginLeft: 3 }}>
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
      <Text style={{ width: 90, color: '#666666', fontSize: 12 }}>{label}</Text>
      <Text style={{ flex: 1, color: '#111111', fontSize: 12 }}>{String(value)}</Text>
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

  const bg = checkedOut ? '#F5F5F5' : currentlyInside ? '#FAFAFA' : '#FFFFFF';
  const borderColor = meta?.color ?? '#999999';

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 10,
        borderLeftWidth: 3,
        borderLeftColor: borderColor,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.8}
        style={{ padding: 12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {meta ? (
            <MaterialIcons
              name={meta.icon as keyof typeof import('@expo/vector-icons').MaterialIcons.glyphMap}
              size={18}
              color={meta.color}
            />
          ) : null}
          <View style={{ flex: 1, marginLeft: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <VisitorTypeBadge type={a.custom_visitor_type} />
              <Text style={{ fontWeight: '700', color: '#111111', flexShrink: 1 }} numberOfLines={1}>
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
              <Text style={{ fontSize: 11, color: meta?.color ?? '#666666' }}>
                {a.workflow_state}
              </Text>
              {a.custom_number_of_passengers ? (
                <Text style={{ fontSize: 11, color: '#333333', marginLeft: 8 }}>
                  +{a.custom_number_of_passengers}
                </Text>
              ) : null}
              <View style={{ flex: 1 }} />
              <Text style={{ fontSize: 11, color: '#333333' }}>
                {checkedIn ? `In ${fmtTime(a.custom_check_in_time)}` : '—'}
                {checkedOut ? ` → Out ${fmtTime(a.custom_check_out_time)}` : ''}
              </Text>
              {currentlyInside ? (
                <View
                  style={{
                    marginLeft: 6,
                    backgroundColor: '#000000',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>INSIDE</Text>
                </View>
              ) : null}
            </View>
          </View>
          <MaterialIcons
            name={open ? 'expand-less' : 'expand-more'}
            size={20}
            color="#666666"
            style={{ marginLeft: 4 }}
          />
        </View>
      </TouchableOpacity>

      <Collapsible collapsed={!open}>
        <View style={{ padding: 12, paddingTop: 0 }}>
          <View style={{ height: 1, backgroundColor: '#E8E8E8', marginBottom: 8 }} />
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
