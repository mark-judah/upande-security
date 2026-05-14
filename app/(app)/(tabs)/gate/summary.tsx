import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDailySummary } from '@/lib/hooks/useDailySummary';
import { StatCard } from '@/components/ui/StatCard';
import { InsideCard } from '@/components/gate/InsideCard';
import { ActivityRow } from '@/components/gate/ActivityRow';
import { fmtLongDate } from '@/lib/utils/date';

export default function SummaryTab() {
  const today = new Date();
  const { data, isFetching, isLoading, refetch, error } = useDailySummary(today);

  if (!data && !isLoading && !error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: '#F5F5F5',
        }}
      >
        <MaterialIcons name="dashboard" size={60} color="#999999" />
        <TouchableOpacity
          onPress={() => refetch()}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#000000',
            borderRadius: 8,
            paddingHorizontal: 18,
            paddingVertical: 14,
            minHeight: 48,
          }}
        >
          <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6 }}>
            Load Today&apos;s Summary
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F5F5' }}
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />
      }
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#111111', marginBottom: 12 }}>
        Gate Activity — {fmtLongDate(today)}
      </Text>

      {error ? (
        <View
          style={{
            backgroundColor: '#FAFAFA',
            padding: 12,
            borderRadius: 8,
            borderLeftWidth: 3,
            borderLeftColor: '#000000',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: '#000000', fontSize: 13 }}>
            {error instanceof Error ? error.message : 'Failed to load summary'}
          </Text>
        </View>
      ) : null}

      {data ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <StatCard
              label="Checked In"
              value={data.total_checked_in}
              color="#000000"
              icon="login"
            />
            <StatCard
              label="Checked Out"
              value={data.total_checked_out}
              color="#555555"
              icon="logout"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <StatCard
              label="Inside"
              value={data.still_inside}
              color="#000000"
              icon="person-pin"
            />
            <StatCard
              label="Total"
              value={data.all.length}
              color="#999999"
              icon="people"
            />
          </View>

          {data.still_inside_list.length > 0 ? (
            <View style={{ marginBottom: 16 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#000000',
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <MaterialIcons name="person-pin" size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 6 }}>
                  Currently on Premises ({data.still_inside_list.length})
                </Text>
              </View>
              {data.still_inside_list.map((a) => (
                <InsideCard key={a.name} appointment={a} />
              ))}
            </View>
          ) : null}

          {data.all.length > 0 ? (
            <View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: '#333333',
                  marginBottom: 8,
                }}
              >
                Today&apos;s Activity Log
              </Text>
              {data.all.map((a) => (
                <ActivityRow key={a.name} appointment={a} />
              ))}
            </View>
          ) : (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <MaterialIcons name="inbox" size={40} color="#999999" />
              <Text style={{ color: '#666666', marginTop: 8 }}>No activity yet today</Text>
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
