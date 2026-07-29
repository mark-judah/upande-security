import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import {
  usePendingApprovals,
  useApprovalAction,
  useApproverConfig,
} from '@/lib/hooks/usePendingApprovals';
import { ApprovalCard } from '@/components/gate/ApprovalCard';

export default function ApprovalsScreen() {
  const configs = useApproverConfig();
  const { data, isLoading, isFetching, refetch } = usePendingApprovals();
  const approvalAction = useApprovalAction();

  const appointments = data ?? [];

  return (
    <Screen title="Approvals" scroll={false} contentPadded={false}>
      <View style={styles.container}>
        {appointments.length > 0 ? (
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{appointments.length} pending</Text>
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#000000" />
          </View>
        ) : appointments.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="check-circle-outline" size={56} color="#CCCCCC" />
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptySubtext}>No pending approvals right now</Text>
          </View>
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.name}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={refetch}
                tintColor="#000000"
              />
            }
            renderItem={({ item }) => (
              <ApprovalCard
                appointment={item}
                configs={configs}
                onAction={(name, action) => approvalAction.mutate({ name, action })}
                busy={approvalAction.isPending}
              />
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  badgeRow: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#AAAAAA',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#BBBBBB',
  },
  list: {
    padding: 14,
  },
});
