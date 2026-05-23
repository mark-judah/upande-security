import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePendingApprovals } from '@/lib/hooks/usePendingApprovals';
import { fmtDateTime } from '@/lib/utils/date';
import type { PendingApprovalRow } from '@/lib/services/api';

function AwaitingCard({ item }: { item: PendingApprovalRow }) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#FB8C00',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <MaterialIcons name="hourglass-top" size={16} color="#FB8C00" />
          <Text
            style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#111111', marginLeft: 6 }}
            numberOfLines={1}
          >
            {item.customer_name}
          </Text>
          <View
            style={{
              backgroundColor: 'rgba(251,140,0,0.1)',
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderWidth: 1,
              borderColor: '#FB8C00',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#FB8C00' }}>
              Awaiting Host
            </Text>
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="person" size={13} color="#888888" />
            <Text style={{ fontSize: 13, color: '#444444', marginLeft: 5 }}>
              Visiting: <Text style={{ fontWeight: '600' }}>{item.host_name || item.host_id}</Text>
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
              <Text style={{ fontSize: 13, color: '#444444', marginLeft: 5, flex: 1 }} numberOfLines={2}>
                {item.purpose}
              </Text>
            </View>
          ) : null}
          {item.scheduled_time ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="schedule" size={13} color="#888888" />
              <Text style={{ fontSize: 13, color: '#888888', marginLeft: 5 }}>
                {fmtDateTime(item.scheduled_time)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function PendingTab() {
  const { data, isFetching, isLoading, error, refetch } = usePendingApprovals();
  const items = data ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F5F5' }}
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#111111' }}>
          Awaiting Host Approval
        </Text>
        {isLoading ? <ActivityIndicator size="small" color="#666666" /> : null}
      </View>

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
          <MaterialIcons name="check-circle-outline" size={56} color="#BBBBBB" />
          <Text style={{ color: '#999999', fontSize: 15, marginTop: 12, fontWeight: '600' }}>
            No pending approvals
          </Text>
          <Text style={{ color: '#BBBBBB', fontSize: 13, marginTop: 4 }}>
            Pull down to refresh
          </Text>
        </View>
      ) : null}

      {items.map((item) => (
        <AwaitingCard key={item.name} item={item} />
      ))}
    </ScrollView>
  );
}
