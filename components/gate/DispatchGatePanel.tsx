import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DispatchSearchHit, GateVerificationStatus, VerifyDispatchResult } from '@/lib/services/api';
import { useDispatchSearch } from '@/lib/hooks/useDispatchSearch';
import { useVerifyDispatch } from '@/lib/hooks/useVerifyDispatch';
import { useGateStore } from '@/lib/stores/gateStore';
import { extractDispatchReference } from '@/lib/utils/qr';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { DispatchLookup } from './DispatchLookup';
import { DispatchResultCard } from './DispatchResultCard';
import { DispatchAwaitingReturn } from './DispatchAwaitingReturn';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

/**
 * Gate Dispatch Verification — config-driven gate check of trucks against
 * a Dispatch Form (or any future dispatch doctype). Self-contained, like
 * StaffCheckInPanel: owns its own search/decision state.
 */
export function DispatchGatePanel() {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<DispatchSearchHit | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifyDispatchResult | null>(null);

  const feedback = useFeedback();
  const search = useDispatchSearch();
  const verify = useVerifyDispatch();

  const pendingScannedDispatch = useGateStore((s) => s.pendingScannedDispatch);
  const setPendingScannedDispatch = useGateStore((s) => s.setPendingScannedDispatch);

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
      feedback.error(e instanceof Error ? e.message : 'Dispatch lookup failed');
    }
  }

  function onManualSearch() {
    const q = query.trim();
    if (!q) {
      feedback.warning('Enter a dispatch reference');
      return;
    }
    runSearch(q);
  }

  useEffect(() => {
    if (pendingScannedDispatch) {
      const reference = extractDispatchReference(pendingScannedDispatch);
      setPendingScannedDispatch(null);
      if (reference) {
        setQuery(reference);
        runSearch(reference);
      } else {
        feedback.error('Could not read a dispatch reference from that scan');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScannedDispatch]);

  async function onDecide(status: GateVerificationStatus, remarks: string) {
    if (!found) return;
    try {
      const result = await verify.mutateAsync({
        input: {
          reference: found.reference_name,
          gate_verification_status: status,
          remarks: remarks || undefined,
        },
        context: {
          reference_doctype: found.reference_doctype,
          vehicle_no: found.vehicle_no,
          driver_name: found.driver_name,
          farm: found.farm,
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
              {verified.reference_name} — {verified.gate_verification_status}
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
              Recorded. If this vehicle returns to the farm later, confirm it from the &quot;Awaiting
              return&quot; list below — it doesn&apos;t have to be this session.
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
            <Text style={{ color: COLORS.text, fontFamily: fontFamily.semiBold }}>Verify another dispatch</Text>
          </TouchableOpacity>
        </View>
      ) : found ? (
        <DispatchResultCard result={found} onDecide={onDecide} busy={verify.isPending} onReset={reset} />
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
              No dispatch document found for &quot;{notFoundQuery}&quot;
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
        <DispatchLookup value={query} onChangeText={setQuery} onSubmit={onManualSearch} busy={search.isPending} />
      )}

      <DispatchAwaitingReturn />
    </View>
  );
}
