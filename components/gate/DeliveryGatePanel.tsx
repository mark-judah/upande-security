import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DeliverySearchHit, GateVerificationStatus, VerifyDeliveryResult } from '@/lib/services/api';
import { useDeliverySearch } from '@/lib/hooks/useDeliverySearch';
import { useVerifyDelivery } from '@/lib/hooks/useVerifyDelivery';
import { useGateStore } from '@/lib/stores/gateStore';
import { extractDeliveryReference } from '@/lib/utils/qr';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { DeliveryLookup } from './DeliveryLookup';
import { DeliveryResultCard } from './DeliveryResultCard';
import { DeliveryAwaitingDeparture } from './DeliveryAwaitingDeparture';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

/**
 * Gate Delivery Verification — gate check of inbound supplier deliveries
 * against Purchase Order. Self-contained, like DispatchGatePanel: owns its
 * own search/decision state.
 */
export function DeliveryGatePanel() {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<DeliverySearchHit | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifyDeliveryResult | null>(null);

  const feedback = useFeedback();
  const search = useDeliverySearch();
  const verify = useVerifyDelivery();

  const pendingScannedDelivery = useGateStore((s) => s.pendingScannedDelivery);
  const setPendingScannedDelivery = useGateStore((s) => s.setPendingScannedDelivery);

  function reset() {
    setQuery('');
    setFound(null);
    setNotFoundQuery(null);
    setVerified(null);
  }

  async function runSearch(reference: string) {
    setFound(null);
    setNotFoundQuery(null);
    setVerified(null);
    try {
      const result = await search.mutateAsync(reference);
      if (result.found) {
        setFound(result);
      } else {
        setNotFoundQuery(reference);
      }
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Delivery lookup failed');
    }
  }

  function onManualSearch() {
    const q = query.trim();
    if (!q) {
      feedback.warning('Enter a PO number or supplier name');
      return;
    }
    runSearch(q);
  }

  useEffect(() => {
    if (pendingScannedDelivery) {
      const reference = extractDeliveryReference(pendingScannedDelivery);
      setPendingScannedDelivery(null);
      if (reference) {
        setQuery(reference);
        runSearch(reference);
      } else {
        feedback.error('Could not read a PO reference from that scan');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScannedDelivery]);

  async function onDecide(
    status: GateVerificationStatus,
    vehicleNo: string,
    driverName: string,
    remarks: string,
  ) {
    if (!found) return;
    try {
      const result = await verify.mutateAsync({
        input: {
          reference: found.purchase_order,
          gate_verification_status: status,
          vehicle_no: vehicleNo || undefined,
          driver_name: driverName || undefined,
          remarks: remarks || undefined,
        },
        context: {
          purchase_order: found.purchase_order,
          supplier_name: found.supplier_name,
          vehicle_no: vehicleNo,
          driver_name: driverName,
        },
      });
      setFound(null);
      setVerified(result);
    } catch {
      // feedback handled in the hook
    }
  }

  return (
    <View style={{ marginTop: spacing.sm }}>
      {verified ? (
        <View
          style={{
            backgroundColor: verified.gate_verification_status === 'Verified' ? '#F0FDF4' : '#FEF2F2',
            borderRadius: borderRadius.md,
            padding: 14,
            marginVertical: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons
              name={verified.gate_verification_status === 'Verified' ? 'checkmark-circle' : 'close-circle'}
              size={22}
              color={verified.gate_verification_status === 'Verified' ? COLORS.success : COLORS.danger}
            />
            <Text
              style={{
                marginLeft: 10,
                fontFamily: fontFamily.semiBold,
                fontSize: fontSize.md,
                color: verified.gate_verification_status === 'Verified' ? COLORS.success : COLORS.danger,
                flex: 1,
              }}
            >
              {verified.purchase_order} — {verified.gate_verification_status}
            </Text>
          </View>
          {verified.gate_verification_status === 'Verified' ? (
            <Text
              style={{
                marginTop: spacing.sm,
                color: COLORS.textSecondary,
                fontSize: fontSize.sm,
                fontFamily: fontFamily.regular,
              }}
            >
              Recorded. Once this truck leaves after offloading, confirm it from the &quot;Awaiting
              departure&quot; list below — it doesn&apos;t have to be this session.
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={reset}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{
              marginTop: spacing.md,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: borderRadius.md,
              paddingVertical: spacing.md,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: COLORS.text, fontFamily: fontFamily.semiBold }}>Verify another delivery</Text>
          </TouchableOpacity>
        </View>
      ) : found ? (
        <DeliveryResultCard result={found} onDecide={onDecide} busy={verify.isPending} onReset={reset} />
      ) : notFoundQuery != null ? (
        <View
          style={{
            backgroundColor: '#FFFBEB',
            borderRadius: borderRadius.md,
            padding: 14,
            marginVertical: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={22} color={COLORS.warn} />
            <Text
              style={{
                marginLeft: 10,
                color: COLORS.warn,
                fontFamily: fontFamily.semiBold,
                fontSize: fontSize.sm,
                flex: 1,
              }}
            >
              No active Purchase Order found for &quot;{notFoundQuery}&quot;
            </Text>
          </View>
          <TouchableOpacity
            onPress={reset}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{
              marginTop: spacing.md,
              borderWidth: 1,
              borderColor: COLORS.warn,
              borderRadius: borderRadius.md,
              paddingVertical: spacing.md,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: COLORS.warn, fontFamily: fontFamily.semiBold }}>Try another reference</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <DeliveryLookup value={query} onChangeText={setQuery} onSubmit={onManualSearch} busy={search.isPending} />
      )}

      <DeliveryAwaitingDeparture />
    </View>
  );
}
