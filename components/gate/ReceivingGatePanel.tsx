import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  ReceivingSearchHit,
  GateVerificationStatus,
  VerifyReceivingResult,
} from '@/lib/services/api';
import { useReceivingSearch } from '@/lib/hooks/useReceivingSearch';
import { useVerifyReceiving } from '@/lib/hooks/useVerifyReceiving';
import { useIssueSupplierBadgeForReceiving } from '@/lib/hooks/useIssueSupplierBadgeForReceiving';
import { useFeatureFlag } from '@/lib/hooks/useSessionInfo';
import { useGateStore } from '@/lib/stores/gateStore';
import { extractReceivingReference } from '@/lib/utils/qr';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { ReceivingLookup } from './ReceivingLookup';
import { ReceivingResultCard } from './ReceivingResultCard';
import { ReceivingAwaitingDeparture } from './ReceivingAwaitingDeparture';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

/**
 * Gate Receiving Verification — gate check of inbound supplier deliveries
 * against Purchase Order. Self-contained, like DispatchGatePanel: owns its
 * own search/decision state.
 */
export function ReceivingGatePanel() {
  const supplierBadgesEnabled = useFeatureFlag('feature_supplier_badges');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<ReceivingSearchHit | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifyReceivingResult | null>(null);
  // Local-only — the badge number the guard is keying in on the post-
  // Verified prompt, and the result once issued (switches the prompt to a
  // one-line confirmation instead of hiding it entirely, so a guard who
  // glances back at the screen still sees what just happened).
  const [badgeNumberInput, setBadgeNumberInput] = useState('');
  const [issuedBadge, setIssuedBadge] = useState<{ badge_number: number } | null>(null);

  const feedback = useFeedback();
  const search = useReceivingSearch();
  const verify = useVerifyReceiving();
  const issueBadge = useIssueSupplierBadgeForReceiving();

  const pendingScannedReceiving = useGateStore((s) => s.pendingScannedReceiving);
  const setPendingScannedReceiving = useGateStore((s) => s.setPendingScannedReceiving);

  function reset() {
    setQuery('');
    setFound(null);
    setNotFoundQuery(null);
    setVerified(null);
    setBadgeNumberInput('');
    setIssuedBadge(null);
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
      feedback.error(e instanceof Error ? e.message : 'Receiving lookup failed');
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
    if (pendingScannedReceiving) {
      const reference = extractReceivingReference(pendingScannedReceiving);
      setPendingScannedReceiving(null);
      if (reference) {
        setQuery(reference);
        runSearch(reference);
      } else {
        feedback.error('Could not read a PO reference from that scan');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScannedReceiving]);

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

  async function onIssueBadge() {
    if (!verified) return;
    const badgeNumber = badgeNumberInput.trim();
    if (!badgeNumber) {
      feedback.warning('Enter a badge number');
      return;
    }
    try {
      const result = await issueBadge.mutateAsync({ name: verified.name, badgeNumber });
      setIssuedBadge({ badge_number: result.badge_number });
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
          {verified.gate_verification_status === 'Verified' && supplierBadgesEnabled && !verified.has_badge ? (
            issuedBadge ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
                <Ionicons name="id-card" size={16} color={COLORS.success} />
                <Text
                  style={{
                    marginLeft: spacing.xs,
                    color: COLORS.success,
                    fontFamily: fontFamily.semiBold,
                    fontSize: fontSize.sm,
                  }}
                >
                  Badge #{issuedBadge.badge_number} issued to {verified.supplier_name}
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: spacing.md }}>
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontSize: fontSize.sm,
                    fontFamily: fontFamily.regular,
                    marginBottom: spacing.sm,
                  }}
                >
                  Issue {verified.supplier_name}&apos;s driver a badge for this delivery. It&apos;s
                  returned to the pool when departure is confirmed below.
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TextInput
                    value={badgeNumberInput}
                    onChangeText={setBadgeNumberInput}
                    placeholder="Badge #"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    editable={!issueBadge.isPending}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      borderRadius: borderRadius.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 10,
                      fontSize: fontSize.md,
                      color: COLORS.text,
                      backgroundColor: COLORS.surface,
                    }}
                  />
                  <TouchableOpacity
                    onPress={onIssueBadge}
                    disabled={issueBadge.isPending}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    style={{
                      backgroundColor: COLORS.primary,
                      opacity: issueBadge.isPending ? 0.6 : 1,
                      borderRadius: borderRadius.md,
                      paddingHorizontal: spacing.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 44,
                    }}
                  >
                    {issueBadge.isPending ? (
                      <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
                    ) : (
                      <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm }}>
                        Issue Badge
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )
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
            <Text style={{ color: COLORS.text, fontFamily: fontFamily.semiBold }}>Verify another supplier delivery</Text>
          </TouchableOpacity>
        </View>
      ) : found ? (
        <ReceivingResultCard result={found} onDecide={onDecide} busy={verify.isPending} onReset={reset} />
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
        <ReceivingLookup
          value={query}
          onChangeText={setQuery}
          onSubmit={onManualSearch}
          busy={search.isPending}
        />
      )}

      <ReceivingAwaitingDeparture />
    </View>
  );
}
