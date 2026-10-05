import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  GateVerificationStatus,
  VehicleMovementType,
  VehicleTaskSearchHit,
  VerifyVehicleTaskResult,
} from '@/lib/services/api';
import { useVehicleTaskSearch } from '@/lib/hooks/useVehicleTaskSearch';
import { useVerifyVehicleTask } from '@/lib/hooks/useVerifyVehicleTask';
import { useGateStore } from '@/lib/stores/gateStore';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { VehicleTaskLookup } from './VehicleTaskLookup';
import { VehicleTaskResultCard } from './VehicleTaskResultCard';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

/**
 * Gate Vehicle Verification — company vehicles/tractors checked against
 * their task document. Self-contained, like DispatchGatePanel: owns its
 * own search/decision state.
 */
export function VehicleGatePanel() {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<VehicleTaskSearchHit | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifyVehicleTaskResult | null>(null);
  // The exact string that produced the match. verify_vehicle_task_at_gate
  // re-resolves the source itself, matching this against the configured
  // reference field (a plate/serial) - not the task's document name - so
  // the guard's original scan is what has to be sent back.
  const [matchedRef, setMatchedRef] = useState('');

  const feedback = useFeedback();
  const search = useVehicleTaskSearch();
  const verify = useVerifyVehicleTask();

  const pendingScannedVehicle = useGateStore((s) => s.pendingScannedVehicle);
  const setPendingScannedVehicle = useGateStore((s) => s.setPendingScannedVehicle);

  function reset() {
    setQuery('');
    setFound(null);
    setNotFoundQuery(null);
    setVerified(null);
    setMatchedRef('');
  }

  async function runSearch(reference: string) {
    setFound(null);
    setNotFoundQuery(null);
    setVerified(null);
    try {
      const result = await search.mutateAsync(reference);
      if (result.found) {
        setMatchedRef(reference);
        setFound(result);
      } else {
        setNotFoundQuery(reference);
      }
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Vehicle lookup failed');
    }
  }

  function onManualSearch() {
    const q = query.trim();
    if (!q) {
      feedback.warning('Enter a number plate or serial');
      return;
    }
    runSearch(q);
  }

  useEffect(() => {
    if (pendingScannedVehicle) {
      const reference = pendingScannedVehicle;
      setPendingScannedVehicle(null);
      setQuery(reference);
      runSearch(reference);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScannedVehicle]);

  async function onDecide(
    movement: VehicleMovementType,
    status: GateVerificationStatus,
    remarks: string,
  ) {
    if (!found) return;
    try {
      const result = await verify.mutateAsync({
        input: {
          reference: matchedRef,
          movement_type: movement,
          gate_verification_status: status,
          remarks: remarks || undefined,
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
              {verified.reference_name} — {verified.movement_type} {verified.gate_verification_status}
            </Text>
          </View>
          <Text
            style={{
              marginTop: spacing.sm,
              color: COLORS.textSecondary,
              fontSize: fontSize.sm,
              fontFamily: fontFamily.regular,
            }}
          >
            {verified.movement_type === 'Exit'
              ? `Recorded at ${verified.farm}. The trip closes when this vehicle is scanned back in, at whichever gate it returns to.`
              : verified.unmatched_entry
                ? `Recorded at ${verified.farm}, but no exit was on file for it — logged as an arrival with no logged departure.`
                : `Recorded at ${verified.farm}. The trip is now complete.`}
          </Text>
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
            <Text style={{ color: COLORS.text, fontFamily: fontFamily.semiBold }}>Check another vehicle</Text>
          </TouchableOpacity>
        </View>
      ) : found ? (
        <VehicleTaskResultCard
          result={found}
          onDecide={onDecide}
          busy={verify.isPending}
          onReset={reset}
        />
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
              No vehicle task found for &quot;{notFoundQuery}&quot;
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
            <Text style={{ color: COLORS.warn, fontFamily: fontFamily.semiBold }}>Try another vehicle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <VehicleTaskLookup
          value={query}
          onChangeText={setQuery}
          onSubmit={onManualSearch}
          busy={search.isPending}
        />
      )}
    </View>
  );
}
