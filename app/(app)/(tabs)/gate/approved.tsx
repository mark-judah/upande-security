import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useApprovedAppointments } from '@/lib/hooks/useApprovedAppointments';
import { useCheckIn } from '@/lib/hooks/useCheckIn';
import { useCheckOut } from '@/lib/hooks/useCheckOut';
import { fmtDateTime } from '@/lib/utils/date';
import type { ApprovedAppointmentRow } from '@/lib/services/api';

type Status = 'Approved by Host' | 'Visitor Checked In' | string;

function statusStyle(state: Status) {
  if (state === 'Visitor Checked In') {
    return {
      accent: '#1E88E5',
      tint: 'rgba(30,136,229,0.10)',
      label: 'Inside',
      icon: 'login' as const,
    };
  }
  return {
    accent: '#43A047',
    tint: 'rgba(67,160,71,0.10)',
    label: 'Approved',
    icon: 'check-circle' as const,
  };
}

function ApprovedCard({
  item,
  onAction,
  busy,
}: {
  item: ApprovedAppointmentRow;
  onAction: (item: ApprovedAppointmentRow) => void;
  busy: boolean;
}) {
  const s = statusStyle(item.workflow_state);
  const isCheckedIn = item.workflow_state === 'Visitor Checked In';
  const actionLabel = isCheckedIn ? 'CHECK OUT' : 'CHECK IN';
  const actionIcon = isCheckedIn ? 'logout' : 'login';
  const actionColor = isCheckedIn ? '#E53935' : '#43A047';

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: s.accent,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <MaterialIcons name={s.icon} size={16} color={s.accent} />
          <Text
            style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#111111', marginLeft: 6 }}
            numberOfLines={1}
          >
            {item.customer_name}
          </Text>
          <View
            style={{
              backgroundColor: s.tint,
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderWidth: 1,
              borderColor: s.accent,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: s.accent }}>{s.label}</Text>
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="person" size={13} color="#888888" />
            <Text style={{ fontSize: 13, color: '#444444', marginLeft: 5 }}>
              Visiting:{' '}
              <Text style={{ fontWeight: '600' }}>{item.host_name || item.host_id}</Text>
            </Text>
          </View>
          {item.phone ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="phone" size={13} color="#888888" />
              <Text style={{ fontSize: 13, color: '#444444', marginLeft: 5 }}>{item.phone}</Text>
            </View>
          ) : null}
          {item.purpose ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <MaterialIcons name="notes" size={13} color="#888888" style={{ marginTop: 1 }} />
              <Text
                style={{ fontSize: 13, color: '#444444', marginLeft: 5, flex: 1 }}
                numberOfLines={2}
              >
                {item.purpose}
              </Text>
            </View>
          ) : null}
          {isCheckedIn && item.check_in_time ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="schedule" size={13} color="#888888" />
              <Text style={{ fontSize: 13, color: '#888888', marginLeft: 5 }}>
                In: {fmtDateTime(item.check_in_time)}
              </Text>
            </View>
          ) : item.scheduled_time ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="schedule" size={13} color="#888888" />
              <Text style={{ fontSize: 13, color: '#888888', marginLeft: 5 }}>
                Scheduled: {fmtDateTime(item.scheduled_time)}
              </Text>
            </View>
          ) : null}
          {item.transport || item.plate ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons
                name={item.transport === 'On Foot' ? 'directions-walk' : 'directions-car'}
                size={13}
                color="#888888"
              />
              <Text style={{ fontSize: 13, color: '#888888', marginLeft: 5 }}>
                {[item.transport, item.plate, item.colour].filter(Boolean).join(' · ')}
                {item.passengers > 0 ? ` · +${item.passengers}` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={() => onAction(item)}
          disabled={busy}
          activeOpacity={0.75}
          style={{
            marginTop: 12,
            backgroundColor: busy ? '#BDBDBD' : actionColor,
            borderRadius: 8,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialIcons name={actionIcon} size={16} color="#FFFFFF" />
          )}
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ApprovedTab() {
  const { data, isFetching, isLoading, error, refetch } = useApprovedAppointments();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const [activeName, setActiveName] = useState<string | null>(null);

  const items = data ?? [];
  const inside = items.filter((i) => i.workflow_state === 'Visitor Checked In').length;
  const approved = items.length - inside;

  const onAction = (item: ApprovedAppointmentRow) => {
    if (checkIn.isPending || checkOut.isPending) return;
    if (item.workflow_state === 'Visitor Checked In') {
      Alert.alert('Check out?', `Check out ${item.customer_name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check out',
          style: 'destructive',
          onPress: async () => {
            setActiveName(item.name);
            try {
              await checkOut.mutateAsync(item.name);
            } finally {
              setActiveName(null);
            }
          },
        },
      ]);
    } else {
      Alert.alert('Check in?', `Check in ${item.customer_name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check in',
          onPress: async () => {
            setActiveName(item.name);
            try {
              await checkIn.mutateAsync({ name: item.name });
            } finally {
              setActiveName(null);
            }
          },
        },
      ]);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F5F5' }}
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#111111' }}>
          Approved Visitors
        </Text>
        {isLoading ? <ActivityIndicator size="small" color="#666666" /> : null}
      </View>

      {!isLoading && items.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              padding: 10,
              borderWidth: 1,
              borderColor: '#E0E0E0',
            }}
          >
            <Text style={{ fontSize: 11, color: '#888888', fontWeight: '600' }}>READY TO ENTER</Text>
            <Text
              style={{ fontSize: 20, color: '#43A047', fontWeight: '700', marginTop: 2 }}
            >
              {approved}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              padding: 10,
              borderWidth: 1,
              borderColor: '#E0E0E0',
            }}
          >
            <Text style={{ fontSize: 11, color: '#888888', fontWeight: '600' }}>INSIDE NOW</Text>
            <Text
              style={{ fontSize: 20, color: '#1E88E5', fontWeight: '700', marginTop: 2 }}
            >
              {inside}
            </Text>
          </View>
        </View>
      ) : null}

      {error ? (
        <View
          style={{
            backgroundColor: '#FFF3E0',
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <MaterialIcons name="error-outline" size={18} color="#E65100" />
          <Text style={{ color: '#E65100', fontSize: 13, marginLeft: 8, flex: 1 }}>
            {error instanceof Error ? error.message : 'Failed to load'}
          </Text>
        </View>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <MaterialIcons name="event-available" size={56} color="#BBBBBB" />
          <Text style={{ color: '#999999', fontSize: 15, marginTop: 12, fontWeight: '600' }}>
            No approved visitors
          </Text>
          <Text style={{ color: '#BBBBBB', fontSize: 13, marginTop: 4 }}>
            Pull down to refresh
          </Text>
        </View>
      ) : null}

      {items.map((item) => (
        <ApprovedCard
          key={item.name}
          item={item}
          onAction={onAction}
          busy={activeName === item.name && (checkIn.isPending || checkOut.isPending)}
        />
      ))}
    </ScrollView>
  );
}
