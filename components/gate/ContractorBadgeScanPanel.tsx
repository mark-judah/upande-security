import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api, type ContractorBadgeScan, type VisitCarriedItem } from '@/lib/services/api';
import { useItemsExitCheck } from '@/components/gate/CheckOutItemsSheet';
import { useGateFarm } from '@/lib/hooks/useGateFarm';
import { useFeatureFlag } from '@/lib/hooks/useSessionInfo';
import { Button } from '@/src/core/ui/Button';
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
 * On an entry the guard ticks the items that came back in with them and can
 * add new ones. "Leaving for good" returns the badge; when the last crew
 * member leaves, the contractor visit is checked out.
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
  const itemsEnabled = useFeatureFlag('feature_carried_items');
  const [entry, setEntry] = useState<{ badge: string; holder: string; items: VisitCarriedItem[] } | null>(null);
  const [leaving, setLeaving] = useState(false);
  // Items from the last exit scan - the checklist loads them from here.
  const exitItems = useRef<VisitCarriedItem[]>([]);
  const exitCheck = useItemsExitCheck({
    load: async () => exitItems.current,
    markOut: (badge, ticked, extras) => api.checkOutBadgeItems(badge, ticked, extras),
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
        if (r.direction === 'Exit') {
          exitItems.current = r.items ?? [];
          exitCheck.begin(r.badge, r.holder_name ?? 'contractor', () => {});
        } else if (itemsEnabled && r.items) {
          setEntry({ badge: r.badge, holder: r.holder_name ?? 'contractor', items: r.items });
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
          {result.accepted && result.direction === 'Exit' ? (
            <TouchableOpacity
              onPress={() => confirmLeaveForGood(result.badge, result.holder_name)}
              disabled={leaving}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}
            >
              {leaving ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <Ionicons name="exit-outline" size={18} color={COLORS.danger} />
              )}
              <Text style={{ marginLeft: 6, color: COLORS.danger, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm }}>
                Leaving for good - return the badge
              </Text>
            </TouchableOpacity>
          ) : null}
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
      <EntryItemsSheet
        entry={entry}
        onClose={() => setEntry(null)}
        onSaved={(added, back) => {
          setEntry(null);
          if (added || back) feedback.success(`Items recorded — ${back} back in${added ? `, ${added} new` : ''}`);
        }}
      />
    </View>
  );

  function confirmLeaveForGood(badge: string, holder: string) {
    Alert.alert(
      'Leaving for good?',
      `${holder} is not coming back before the job ends. Their badge goes back to the pool. When the last crew member leaves, the contractor visit is checked out.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Return badge',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              const r = await api.leaveForGood(badge);
              setResult(null);
              if (r.not_seen_leaving.length) feedback.warning('Not seen leaving: ' + r.not_seen_leaving.join(', '));
              feedback.success(
                r.visit_checked_out
                  ? `Badge returned — everyone has left, the contractor visit is checked out`
                  : `Badge returned — ${r.still_on_site} still on site`,
              );
            } catch (e) {
              feedback.error(e instanceof Error ? e.message : 'Could not return the badge');
            } finally {
              setLeaving(false);
            }
          },
        },
      ],
    );
  }
}

type NewItem = { key: string; item: string; qty: string };

/** Entry at a farm: tick the holder's items that came back in with them, add
 *  anything new they bring. */
function EntryItemsSheet({
  entry,
  onClose,
  onSaved,
}: {
  entry: { badge: string; holder: string; items: VisitCarriedItem[] } | null;
  onClose: () => void;
  onSaved: (added: number, back: number) => void;
}) {
  const feedback = useFeedback();
  const [ticked, setTicked] = useState<string[]>([]);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [saving, setSaving] = useState(false);
  const key = entry?.badge;

  useEffect(() => {
    setTicked([]);
    setNewItems([]);
  }, [key]);

  async function save() {
    if (!entry) return;
    setSaving(true);
    try {
      const add = newItems
        .filter((n) => n.item.trim())
        .map((n) => ({ item: n.item.trim(), qty: Math.max(parseInt(n.qty, 10) || 1, 1) }));
      await api.checkInBadgeItems(entry.badge, ticked, add);
      onSaved(add.length, ticked.length);
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Could not record the items');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={entry != null} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderTopLeftRadius: borderRadius.lg,
            borderTopRightRadius: borderRadius.lg,
            padding: spacing.lg,
          }}
        >
          <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.md, color: COLORS.text }}>
            Items coming in with {entry?.holder}
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2, marginBottom: spacing.sm }}>
            Tick what they brought back in, and add anything new.
          </Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {entry && !entry.items.length ? (
              <Text style={{ fontSize: fontSize.sm, color: COLORS.textMuted }}>No items left with them earlier.</Text>
            ) : null}
            {entry?.items.map((it) => {
              const name = it.name ?? '';
              const on = ticked.includes(name);
              return (
                <TouchableOpacity
                  key={name}
                  onPress={() => setTicked((t) => (on ? t.filter((n) => n !== name) : [...t, name]))}
                  disabled={saving}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                >
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? COLORS.success : COLORS.textMuted} />
                  <Text style={{ marginLeft: spacing.sm, fontSize: fontSize.sm, color: COLORS.text }}>
                    {it.item}
                    {it.qty && it.qty > 1 ? ' ×' + String(it.qty) : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {newItems.map((n) => (
              <View key={n.key} style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                <TextInput
                  value={n.item}
                  onChangeText={(v) => setNewItems((xs) => xs.map((x) => (x.key === n.key ? { ...x, item: v } : x)))}
                  placeholder="New item"
                  placeholderTextColor={COLORS.textMuted}
                  editable={!saving}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 8,
                    color: COLORS.text,
                  }}
                />
                <TextInput
                  value={n.qty}
                  onChangeText={(v) =>
                    setNewItems((xs) => xs.map((x) => (x.key === n.key ? { ...x, qty: v.replace(/[^0-9]/g, '') } : x)))
                  }
                  keyboardType="number-pad"
                  editable={!saving}
                  style={{
                    width: 64,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 8,
                    color: COLORS.text,
                  }}
                />
                <TouchableOpacity
                  onPress={() => setNewItems((xs) => xs.filter((x) => x.key !== n.key))}
                  hitSlop={8}
                  style={{ justifyContent: 'center' }}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={() =>
                setNewItems((xs) => [...xs, { key: Math.random().toString(36).slice(2), item: '', qty: '1' }])
              }
              disabled={saving}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={{ marginLeft: 6, color: COLORS.primary, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm }}>
                Add a new item
              </Text>
            </TouchableOpacity>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Button label="Skip" variant="outline" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
            <Button label="Record items" iconLeft="log-in-outline" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
