import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import {
  usePendingApprovals,
  useApprovalAction,
  useApproverConfig,
} from '@/lib/hooks/usePendingApprovals';
import { ApprovalCard } from '@/components/gate/ApprovalCard';

export default function ApprovalsScreen() {
  const insets = useSafeAreaInsets();
  const configs = useApproverConfig();
  const { data, isLoading, isFetching, refetch } = usePendingApprovals();
  const approvalAction = useApprovalAction();

  const appointments = data ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialIcons name="approval" size={22} color="#111111" />
        <Text style={styles.headerTitle}>Pending Approvals</Text>
        {appointments.length > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{appointments.length}</Text>
          </View>
        ) : null}
      </View>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    flex: 1,
  },
  badge: {
    backgroundColor: '#111111',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
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
