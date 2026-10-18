import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import { useReceivingStore } from '@/lib/stores/receivingStore';
import { useConfirmReceivingDeparture } from '@/lib/hooks/useConfirmReceivingDeparture';
import { useFeatureFlag } from '@/lib/hooks/useSessionInfo';
import { ReceivingExitSheet } from './ReceivingExitSheet';
import { fmtTime } from '@/lib/utils/date';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

/**
 * Receivings verified at the gate but not yet confirmed departed. Persisted
 * across screen sessions / app restarts (see receivingStore) since a truck
 * checked in on one shift may only leave — offloading takes time — much
 * later, possibly to a different guard.
 */
export function ReceivingAwaitingDeparture() {
  const localPending = useReceivingStore((s) => s.pending);
  const confirmDeparture = useConfirmReceivingDeparture();
  const itemsEnabled = useFeatureFlag('feature_carried_items');
  const [checking, setChecking] = useState<string | null>(null);

  // The server's list covers every truck at this farm, whoever let it in.
  // A server without it (older build) falls back to this phone's own list.
  const serverList = useQuery({
    queryKey: ['receiving-awaiting'],
    queryFn: () => api.listReceivingsAwaitingDeparture(),
    refetchInterval: 60_000,
    retry: false,
  });
  const pending = serverList.data
    ? serverList.data.map((t) => ({
        name: t.name,
        supplier_name: t.supplier_name,
        detail: [t.purchase_orders.join(', '), t.vehicle_no, t.driver_name].filter(Boolean).join(' · '),
        arrived: t.arrived_at,
        items: t.items_inside,
      }))
    : localPending.map((e) => ({
        name: e.name,
        supplier_name: e.supplier_name,
        detail: [e.purchase_order, e.vehicle_no, e.driver_name].filter(Boolean).join(' · '),
        arrived: e.verified_at,
        items: 0,
      }));

  function onDepart(name: string) {
    // The exit check needs the newer server; without it, depart as before.
    if (itemsEnabled && serverList.data) setChecking(name);
    else confirmDeparture.mutate({ name });
  }

  if (pending.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text
        style={{
          fontFamily: fontFamily.semiBold,
          fontSize: fontSize.sm,
          color: COLORS.textSecondary,
          marginBottom: spacing.sm,
        }}
      >
        Awaiting departure ({pending.length})
      </Text>
      {pending.map((entry) => (
        <View
          key={entry.name}
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.sm,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="cube-outline" size={18} color={COLORS.text} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text }}>
                {entry.supplier_name}
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
                {entry.detail || '—'}
                {' · Arrived '}
                {fmtTime(entry.arrived)}
              </Text>
              {entry.items ? (
                <Text style={{ color: COLORS.warn, fontSize: fontSize.xs, fontFamily: fontFamily.semiBold }}>
                  {entry.items} item{entry.items === 1 ? '' : 's'} declared on the way in - check at exit
                </Text>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            onPress={() => onDepart(entry.name)}
            disabled={confirmDeparture.isPending}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: COLORS.success,
              opacity: confirmDeparture.isPending ? 0.6 : 1,
              borderRadius: borderRadius.sm,
              paddingVertical: spacing.sm + 2,
              marginTop: spacing.sm,
              minHeight: 40,
            }}
          >
            {confirmDeparture.isPending ? (
              <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={16} color={COLORS.textOnPrimary} />
                <Text
                  style={{
                    color: COLORS.textOnPrimary,
                    fontFamily: fontFamily.semiBold,
                    marginLeft: spacing.sm - 2,
                    fontSize: fontSize.sm,
                    letterSpacing: 0.3,
                  }}
                >
                  CONFIRM DEPARTURE
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ))}
      <ReceivingExitSheet
        name={checking}
        onClose={() => setChecking(null)}
        onConfirm={(name, exit) => confirmDeparture.mutateAsync({ name, exit })}
      />
    </View>
  );
}
