import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LiveTimer } from '@/components/ui/LiveTimer';
import { fmtTime } from '@/lib/utils/date';
import { WORKFLOW_META } from '@/constants/workflowStates';
import { useCheckOut } from '@/lib/hooks/useCheckOut';
import { useContractorCheckOut } from '@/lib/hooks/useContractorCheckOut';
import type { Appointment } from '@/lib/api/types';

type Props = { appointment: Appointment };

const VISITOR_TYPE_STYLE: Record<
  NonNullable<Appointment['custom_visitor_type']>,
  { bg: string; fg: string }
> = {
  Visitor:    { bg: '#1E88E5', fg: '#FFFFFF' },
  Staff:      { bg: '#43A047', fg: '#FFFFFF' },
  Contractor: { bg: '#FB8C00', fg: '#FFFFFF' },
  Customer:   { bg: '#8E24AA', fg: '#FFFFFF' },
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

export function InsideCard({ appointment: a }: Props) {
  const checkInDate = a.custom_check_in_time ? new Date(a.custom_check_in_time) : null;
  const meta = WORKFLOW_META[a.workflow_state];
  const isContractor = a.custom_visitor_type === 'Contractor';

  const visitorCheckOut = useCheckOut();
  const contractorCheckOut = useContractorCheckOut();
  const busy = visitorCheckOut.isPending || contractorCheckOut.isPending;

  async function handleCheckOut() {
    if (isContractor) {
      await contractorCheckOut.mutateAsync(a.name);
    } else {
      await visitorCheckOut.mutateAsync(a.name);
    }
  }

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: isContractor ? '#FB8C00' : '#000000',
        shadowColor: '#000000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MaterialIcons
          name={isContractor ? 'engineering' : 'person-pin'}
          size={20}
          color={isContractor ? '#FB8C00' : '#000000'}
        />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <VisitorTypeBadge type={a.custom_visitor_type} />
            <Text
              style={{ fontWeight: '700', color: '#111111', flexShrink: 1 }}
              numberOfLines={1}
            >
              {a.customer_name}
            </Text>
          </View>
          {a.customer_phone_number ? (
            <Text style={{ color: '#666666', fontSize: 12 }}>{a.customer_phone_number}</Text>
          ) : null}
          {isContractor && a.custom_contractor_ref ? (
            <Text style={{ color: '#FB8C00', fontSize: 11, fontWeight: '600' }}>
              {a.custom_contractor_ref}
            </Text>
          ) : null}
        </View>
        {checkInDate ? <LiveTimer entryTime={checkInDate} compact /> : null}
      </View>

      {/* Details row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        {meta ? (
          <>
            <MaterialIcons
              name={meta.icon as keyof typeof import('@expo/vector-icons').MaterialIcons.glyphMap}
              size={14}
              color={meta.color}
            />
            <Text style={{ color: meta.color, fontSize: 12, marginLeft: 4, marginRight: 10 }}>
              {a.workflow_state}
            </Text>
          </>
        ) : null}
        {checkInDate ? (
          <Text style={{ color: '#666666', fontSize: 12, marginRight: 10 }}>
            In {fmtTime(a.custom_check_in_time)}
          </Text>
        ) : null}
        {a.custom_mode_of_transport ? (
          <Text style={{ color: '#666666', fontSize: 12, marginRight: 10 }}>
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
            <MaterialIcons name="directions-car" size={11} color="#333333" />
            <Text style={{ fontSize: 11, color: '#111111', fontWeight: '700', marginLeft: 3 }}>
              {a.custom_vehicles_number_plate}
              {a.custom_vehicles_colour ? ` · ${a.custom_vehicles_colour}` : ''}
            </Text>
          </View>
        ) : null}
        {a.custom_number_of_passengers ? (
          <Text style={{ color: '#333333', fontSize: 12 }}>
            +{a.custom_number_of_passengers} pax
          </Text>
        ) : null}
      </View>

      {/* Check Out button */}
      <TouchableOpacity
        onPress={handleCheckOut}
        disabled={busy}
        activeOpacity={0.8}
        style={{
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isContractor ? '#FB8C00' : '#000000',
          borderRadius: 7,
          paddingVertical: 10,
          opacity: busy ? 0.6 : 1,
          minHeight: 40,
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <MaterialIcons name="logout" size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6, fontSize: 13 }}>
              CHECK OUT
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
