import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api, type VisitorBadgeScan, type VisitorRoute } from '@/lib/services/api';
import { useGateFarm } from '@/lib/hooks/useGateFarm';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { useGateStore } from '@/lib/stores/gateStore';
import { GatePicker } from '@/components/gate/GatePicker';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

const ACCENT = '#0F766E';

type Shown =
  | { kind: 'route'; direction: string; farm: string; visit: VisitorRoute; done?: { returnTo: string | null } }
  | { kind: 'returned'; badgeNumber: number; farm: string }
  | { kind: 'refused'; error: string };

/**
 * A visitor already checked in at one farm and booked on to others of the
 * company walks up with their visitor badge: one scan records their entry
 * or exit at this farm - no new booking, no new badge. The card shows the
 * farms they have been to and the booked farms still ahead.
 *
 * "Final exit - collect badge" checks the visit out here and keeps the
 * badge. A badge collected away from its own farm stays "Held at Other
 * Farm" until it is scanned at its own farm's gate, which puts it back in
 * stock.
 */
export function VisitorBadgeScanPanel() {
  const feedback = useFeedback();
  const ownFarm = useGateFarm().farm;
  const [gate, setGate] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const pending = useGateStore((s) => s.pendingScannedVisitorBadge);
  const setPending = useGateStore((s) => s.setPendingScannedVisitorBadge);

  async function scan(reference: string) {
    setBusy(true);
    setShown(null);
    try {
      const r: VisitorBadgeScan = await api.scanVisitorBadge(reference, gate ?? undefined);
      if (!r.accepted) {
        setShown({ kind: 'refused', error: r.error });
        feedback.error(r.error);
      } else if (r.direction === 'Returned') {
        setShown({ kind: 'returned', badgeNumber: r.badge_number, farm: r.farm });
        feedback.success(`Badge #${r.badge_number} is back in stock`);
      } else {
        setShown({ kind: 'route', direction: r.direction, farm: r.farm, visit: r });
        feedback.success(`${r.direction} recorded — ${r.visitor}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Badge scan failed';
      setShown({ kind: 'refused', error: msg });
      feedback.error(msg);
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

  function confirmFinalExit(visit: VisitorRoute) {
    const ahead = visit.remaining.length ? `\n\nStill booked, not visited: ${visit.remaining.join(', ')}.` : '';
    Alert.alert(
      'Final exit?',
      `${visit.visitor} is leaving for good. The visit is checked out and you keep badge #${visit.badge_number}.${ahead}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check out & collect badge',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              const r = await api.finalExitVisitor(visit.badge, gate ?? undefined);
              if (!r.accepted) {
                setShown({ kind: 'refused', error: r.error });
                feedback.error(r.error);
                return;
              }
              setShown({ kind: 'route', direction: 'Final Exit', farm: r.farm, visit: r, done: { returnTo: r.return_badge_to } });
              feedback.success(
                r.return_badge_to
                  ? `Checked out — keep badge #${r.badge_number} for ${r.return_badge_to}`
                  : `Checked out — badge #${r.badge_number} back in stock`,
              );
            } catch (e) {
              feedback.error(e instanceof Error ? e.message : 'Could not check the visitor out');
            } finally {
              setLeaving(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
      <GatePicker farm={ownFarm} value={gate} onChange={setGate} label="Gate" />
      <TouchableOpacity
        onPress={() => router.push('/scan?intent=visitorBadge')}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: ACCENT,
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
          SCAN VISITOR BADGE
        </Text>
      </TouchableOpacity>
      <Text
        style={{ textAlign: 'center', color: COLORS.textMuted, marginVertical: 8, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}
      >
        Visitor already checked in at another farm? Scan their badge in or out — no new booking.
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
          placeholder="Or type this farm's badge number"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad"
          returnKeyType="go"
          editable={!busy}
          onSubmitEditing={() => number && scan(number)}
          style={{ flex: 1, paddingVertical: 10, fontSize: fontSize.md, color: COLORS.text }}
        />
        <TouchableOpacity onPress={() => number && scan(number)} disabled={busy || !number} hitSlop={8}>
          <Ionicons name="arrow-forward-circle" size={26} color={number ? ACCENT : COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {shown?.kind === 'refused' ? (
        <View style={{ marginTop: spacing.md, borderRadius: borderRadius.md, padding: 14, backgroundColor: '#FEF2F2' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="close-circle" size={22} color={COLORS.danger} />
            <Text style={{ marginLeft: 10, flex: 1, fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.danger }}>
              Not allowed through
            </Text>
          </View>
          <Text style={{ marginTop: 6, color: COLORS.danger, fontSize: fontSize.sm, fontFamily: fontFamily.regular }}>
            {shown.error}
          </Text>
        </View>
      ) : null}

      {shown?.kind === 'returned' ? (
        <View style={{ marginTop: spacing.md, borderRadius: borderRadius.md, padding: 14, backgroundColor: '#F0FDF4' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="return-down-back-outline" size={22} color={COLORS.success} />
            <Text style={{ marginLeft: 10, flex: 1, fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.success }}>
              Badge #{shown.badgeNumber} is back in {shown.farm}&apos;s stock
            </Text>
          </View>
        </View>
      ) : null}

      {shown?.kind === 'route' ? (
        <View style={{ marginTop: spacing.md, borderRadius: borderRadius.md, padding: 14, backgroundColor: '#F0FDF4' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons
              name={shown.direction === 'Entry' ? 'log-in-outline' : 'log-out-outline'}
              size={22}
              color={COLORS.success}
            />
            <Text style={{ marginLeft: 10, flex: 1, fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.success }}>
              {shown.done ? `Checked out at ${shown.farm}` : `${shown.direction} recorded at ${shown.farm}`}
            </Text>
          </View>
          <Text style={{ marginTop: 6, color: COLORS.text, fontSize: fontSize.sm, fontFamily: fontFamily.regular }}>
            {shown.visit.visitor}
            {shown.visit.host ? ` · visiting ${shown.visit.host}` : ''}
            {'\n'}
            Badge #{shown.visit.badge_number} ({shown.visit.badge_farm}) · booked at {shown.visit.home_farm}
          </Text>

          <Text style={{ marginTop: 10, color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.semiBold }}>
            ROUTE SO FAR
          </Text>
          {shown.visit.route.length ? (
            shown.visit.route.map((m, i) => (
              <Text key={i} style={{ color: COLORS.text, fontSize: fontSize.sm, fontFamily: fontFamily.regular }}>
                {m.farm}: in {m.time_in.slice(0, 5)}
                {m.time_out ? ` → out ${m.time_out.slice(0, 5)}` : ' · inside'}
                {m.remarks ? ` (${m.remarks})` : ''}
              </Text>
            ))
          ) : (
            <Text style={{ color: COLORS.textMuted, fontSize: fontSize.sm }}>No gate scans yet</Text>
          )}
          <Text style={{ marginTop: 8, color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.semiBold }}>
            STILL TO VISIT
          </Text>
          <Text style={{ color: COLORS.text, fontSize: fontSize.sm, fontFamily: fontFamily.regular }}>
            {shown.visit.remaining.length ? shown.visit.remaining.join(', ') : 'None — all booked farms visited'}
          </Text>

          {shown.done ? (
            shown.done.returnTo ? (
              <Text style={{ marginTop: 10, color: '#B45309', fontSize: fontSize.sm, fontFamily: fontFamily.semiBold }}>
                Keep badge #{shown.visit.badge_number} and send it back to {shown.done.returnTo}. Scanning it at{' '}
                {shown.done.returnTo}&apos;s gate puts it back in stock.
              </Text>
            ) : null
          ) : (
            <TouchableOpacity
              onPress={() => confirmFinalExit(shown.visit)}
              disabled={leaving}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}
            >
              {leaving ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <Ionicons name="exit-outline" size={18} color={COLORS.danger} />
              )}
              <Text style={{ marginLeft: 6, color: COLORS.danger, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm }}>
                Final exit - collect badge
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}
