import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import {
  usePendingApprovals,
  useApprovalAction,
  useApproverConfig,
} from '@/lib/hooks/usePendingApprovals';
import { ApprovalCard } from '@/components/gate/ApprovalCard';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';

export default function ApprovalsScreen() {
  const configs = useApproverConfig();
  const { data, isLoading, isFetching, refetch } = usePendingApprovals();
  const approvalAction = useApprovalAction();

  const appointments = data ?? [];

  return (
    <Screen
      title="Approvals"
      scroll={false}
      contentPadded={false}
      onRefresh={async () => { await refetch(); }}
    >
      <View style={s.container}>
        {appointments.length > 0 ? (
          <View style={s.badgeRow}>
            <View style={s.badge}>
              <Text style={s.badgeText}>{appointments.length} pending</Text>
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={COLORS.text} />
          </View>
        ) : appointments.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={COLORS.border} />
            <Text style={s.emptyTitle}>All clear</Text>
            <Text style={s.emptySubtext}>No pending approvals right now</Text>
          </View>
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.name}
            contentContainerStyle={s.list}
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
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

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMuted,
  },
  badgeRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.text,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    color: COLORS.textOnPrimary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semiBold,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semiBold,
    color: COLORS.textMuted,
    marginTop: spacing.sm,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: COLORS.textMuted,
  },
  list: {
    padding: spacing.md + 2,
  },
});
