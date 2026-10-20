import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api, type ContractorBadgeScan, type VisitCarriedItem } from '@/lib/services/api';
import { useItemsExitCheck } from '@/components/gate/CheckOutItemsSheet';
import { useGateFarm } from '@/lib/hooks/useGateFarm';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { useGateStore } from '@/lib/stores/gateStore';
import { GatePicker } from '@/components/gate/GatePicker';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

/**
 * A contractor already booked for the job walks up with their Contractor
 * Badge: one scan records their entry or exit at this farm - no new
 * booking. The server works out the direction and refuses (and reports) a
 * badge that is not issued, expired or belongs to another company.
 *
 * On an exit the server also returns the holder's registered items still
 * inside; the guard ticks what leaves with them (the same checklist as a
 * visit check-out) and unticked items are recorded as not seen leaving.
 */
export function ContractorBadgeScanPanel() {
  const feedback = useFeedback();
  const ownFarm = useGateFarm().farm;
  const [gate, setGate] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ContractorBadgeScan | null>(null);
  const pending = useGateStore((s) => s.pendingScannedContractorBadge);
  const setPending = useGateStore((s) => s.setPendingScannedContractorBadge);
  // Items from the last exit scan - the checklist loads them from here.
  const exitItems = useRef<VisitCarriedItem[]>([]);
  const exitCheck = useItemsExitCheck({
    load: async () => exitItems.current,
    markOut: (badge, ticked) => api.checkOutBadgeItems(badge, ticked),
    finish: async () => undefined, // the exit itself was recorded by the scan
  });

  async function scan(reference: string) {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.scanContractorBadge(reference, gate ?? undefined);
      setResult(r);
      if (r.accepted) {
        feedback.success(`${r.direction} recorded — ${r.holder_name}`);
        if (r.direction === 'Exit' && r.items?.length) {
          exitItems.current = r.items;
          exitCheck.begin(r.badge, r.holder_name ?? 'contractor', () => {});
        }
      } else feedback.error(r.error);
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Badge scan failed');
    } finally {
      setBusy(false);
      setNumber('');
    }
  }

  useEffect(() => {
    if (!pending) return;
    const ref = pending;
    setPending(null);
    scan(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <View style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
      <GatePicker farm={ownFarm} value={gate} onChange={setGate} label="Gate" />
      <TouchableOpacity
        onPress={() => router.push('/scan?intent=contractorBadge')}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: '#B45309',
          paddingVertical: 16,
          borderRadius: borderRadius.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 56,
          marginTop: spacing.sm,
        }}
      >
        {busy ? (
          <ActivityIndicator color={COLORS.textOnPrimary} />
        ) : (
          <Ionicons name="qr-code-outline" size={22} color={COLORS.textOnPrimary} />
        )}
        <Text
          style={{
            color: COLORS.textOnPrimary,
            fontFamily: fontFamily.bold,
            marginLeft: spacing.sm,
            fontSize: fontSize.md,
            letterSpacing: 0.5,
          }}
        >
          SCAN CONTRACTOR BADGE
        </Text>
      </TouchableOpacity>
      <Text
        style={{ textAlign: 'center', color: COLORS.textMuted, marginVertical: 8, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}
      >
        Already booked for the job? Scan in or out here — no new booking needed.
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          backgroundColor: COLORS.surface,
        }}
      >
        <TextInput
          value={number}
          onChangeText={(v) => setNumber(v.replace(/[^0-9]/g, ''))}
          placeholder="Or type the badge number"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad"
          returnKeyType="go"
          editable={!busy}
          onSubmitEditing={() => number && scan(number)}
          style={{ flex: 1, paddingVertical: 10, fontSize: fontSize.md, color: COLORS.text }}
        />
        <TouchableOpacity onPress={() => number && scan(number)} disabled={busy || !number} hitSlop={8}>
          <Ionicons name="arrow-forward-circle" size={26} color={number ? '#B45309' : COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {result ? (
        <View
          style={{
            marginTop: spacing.md,
            borderRadius: borderRadius.md,
            padding: 14,
            backgroundColor: result.accepted ? '#F0FDF4' : '#FEF2F2',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons
              name={result.accepted ? (result.direction === 'Entry' ? 'log-in-outline' : 'log-out-outline') : 'close-circle'}
              size={22}
              color={result.accepted ? COLORS.success : COLORS.danger}
            />
            <Text
              style={{
                marginLeft: 10,
                flex: 1,
                fontFamily: fontFamily.semiBold,
                fontSize: fontSize.md,
                color: result.accepted ? COLORS.success : COLORS.danger,
              }}
            >
              {result.accepted ? `${result.direction} recorded at ${result.farm}` : 'Not allowed through'}
            </Text>
          </View>
          {result.accepted ? (
            <Text style={{ marginTop: 6, color: COLORS.text, fontSize: fontSize.sm, fontFamily: fontFamily.regular }}>
              {result.holder_name}
              {result.holder_id_number ? ` · ID ${result.holder_id_number}` : ''}
              {'\n'}
              {result.contractor_name || result.contractor || 'Contractor'} · Badge #{result.badge_number}
              {result.valid_until ? ` · valid to ${result.valid_until}` : ''}
            </Text>
          ) : (
            <Text style={{ marginTop: 6, color: COLORS.danger, fontSize: fontSize.sm, fontFamily: fontFamily.regular }}>
              {result.error}
            </Text>
          )}
        </View>
      ) : null}
      {exitCheck.sheet}
    </View>
  );
}
