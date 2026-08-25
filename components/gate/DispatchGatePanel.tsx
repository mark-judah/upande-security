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
 * Authoritative (server-computed) styling for each item's final
 * `match_status`, shown in the "verified" success card after submit — as
 * opposed to the provisional client-side indicator in DispatchItemChecklist.
 */
const ITEM_MATCH_STATUS_META: Record<
  VerifyDispatchResult['item_checks'][number]['match_status'],
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  Matches: { icon: 'checkmark-circle', color: COLORS.success, bg: '#F0FDF4' },
  Short: { icon: 'arrow-down-circle', color: COLORS.warn, bg: '#FFFBEB' },
  Over: { icon: 'arrow-up-circle', color: COLORS.danger, bg: '#FEF2F2' },
  'Not Checked': { icon: 'help-circle-outline', color: COLORS.textMuted, bg: COLORS.surfaceAlt },
};

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
  // Guard's entered actual counts for the item checklist, keyed by row_id
  // (never item_code — see DispatchItemChecklist for why). Raw strings so
  // the input can hold in-progress decimal typing like "12.".
  const [itemChecks, setItemChecks] = useState<Record<string, string>>({});

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
    setItemChecks({});
  }

  async function runSearch(reference: string) {
    setFound(null);
    setNotFoundQuery(null);
    setVerified(null);
    setItemChecks({});
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

  function onItemCheckChange(rowId: string, text: string) {
    setItemChecks((prev) => ({ ...prev, [rowId]: text }));
  }

  async function onDecide(status: GateVerificationStatus, remarks: string) {
    if (!found) return;
    // Only send entries the guard actually typed a value for — omit
    // anything blank/unparseable rather than sending it as a false 0 count.
    const item_checks = Object.entries(itemChecks).reduce<{ row_id: string; actual_qty: number }[]>(
      (acc, [row_id, raw]) => {
        const trimmed = raw.trim();
        if (trimmed.length === 0) return acc;
        const actual_qty = Number(trimmed);
        if (Number.isNaN(actual_qty)) return acc;
        acc.push({ row_id, actual_qty });
        return acc;
      },
      []
    );
    try {
      const result = await verify.mutateAsync({
        input: {
          reference: found.reference_name,
          gate_verification_status: status,
          remarks: remarks || undefined,
          item_checks: item_checks.length > 0 ? item_checks : undefined,
        },
        context: {
          reference_doctype: found.reference_doctype,
          vehicle_no: found.vehicle_no,
          driver_name: found.driver_name,
          farm: found.farm,
        },
      });
      setFound(null);
      setItemChecks({});
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
          {verified.item_checks.length > 0 ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Text style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text }}>
                Item check results
              </Text>
              {verified.item_checks.map((item, idx) => {
                const meta = ITEM_MATCH_STATUS_META[item.match_status];
                return (
                  <View
                    key={item.item_code + '-' + idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: COLORS.surface,
                      borderRadius: borderRadius.sm,
                      paddingHorizontal: spacing.sm + 2,
                      paddingVertical: spacing.sm - 2,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text }}>
                        {item.item_name}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fontFamily.regular,
                          fontSize: fontSize.xs,
                          color: COLORS.textMuted,
                          marginTop: 2,
                        }}
                      >
                        Expected {item.expected_qty} · Actual {item.actual_qty ?? '—'}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: meta.bg,
                        borderRadius: borderRadius.full,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 4,
                      }}
                    >
                      <Ionicons name={meta.icon} size={14} color={meta.color} />
                      <Text
                        style={{
                          marginLeft: 4,
                          fontFamily: fontFamily.semiBold,
                          fontSize: fontSize.xs,
                          color: meta.color,
                        }}
                      >
                        {item.match_status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
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
        <DispatchResultCard
          result={found}
          onDecide={onDecide}
          busy={verify.isPending}
          onReset={reset}
          itemCheckValues={itemChecks}
          onItemCheckChange={onItemCheckChange}
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
