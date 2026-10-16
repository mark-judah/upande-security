import { useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/core/ui/Button';
import { api, type VisitCarriedItem } from '@/lib/services/api';
import { useCheckOut } from '@/lib/hooks/useCheckOut';
import { useFeatureFlag } from '@/lib/hooks/useSessionInfo';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';

type PendingCheckOut = { name: string; ownerName: string; items: VisitCarriedItem[] };

type ExitCheck = {
  // Items of this record still inside; [] skips the checklist.
  load: (name: string) => Promise<VisitCarriedItem[]>;
  // Record what was ticked; returns the items not seen leaving.
  markOut: (name: string, ticked: string[]) => Promise<{ not_seen_leaving: string[] }>;
  // The normal check-out. Reports its own failures.
  finish: (name: string) => Promise<unknown>;
};

/**
 * Check-out that runs the carried-items exit check first.
 *
 * begin(name, visitorName, confirmPlain): if feature_carried_items is on and
 * the visit still has items inside, opens a checklist - the guard ticks what
 * is leaving, unticked items are recorded as "Not seen leaving", then the
 * normal check_out_visitor runs. Otherwise (no items, flag off, or an older
 * server without the endpoint) it calls confirmPlain - the screen's existing
 * check-out confirmation - unchanged.
 */
export function useItemsAwareCheckOut() {
  const checkOut = useCheckOut();
  const exit = useItemsExitCheck({
    load: async (name) => (await api.getVisitPeopleAndItems(name)).items,
    markOut: (name, ticked) => api.checkOutItems(name, ticked),
    finish: (name) => checkOut.mutateAsync(name),
  });
  return { ...exit, busy: exit.busy || checkOut.isPending };
}

/**
 * The same exit check for any gate record with carried items - visits
 * above, staff in StaffCheckInPanel. The config is read at call time, so
 * it may close over the screen's current state (e.g. the exit gate).
 */
export function useItemsExitCheck(config: ExitCheck) {
  const itemsEnabled = useFeatureFlag('feature_carried_items');
  const feedback = useFeedback();
  const configRef = useRef(config);
  configRef.current = config;
  const [pending, setPending] = useState<PendingCheckOut | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingName, setLoadingName] = useState<string | null>(null);

  async function begin(name: string, ownerName: string, confirmPlain: () => void) {
    if (itemsEnabled) {
      setLoadingName(name);
      try {
        const items = await configRef.current.load(name);
        const inside = items.filter((i) => !i.exit_status || i.exit_status === 'Inside');
        if (inside.length) {
          setTicked([]);
          setPending({ name, ownerName, items: inside });
          return;
        }
      } catch {
        // fall through to the plain check-out
      } finally {
        setLoadingName(null);
      }
    }
    confirmPlain();
  }

  async function complete() {
    if (!pending) return;
    setSaving(true);
    try {
      let result: { not_seen_leaving: string[] };
      try {
        result = await configRef.current.markOut(pending.name, ticked);
      } catch (e) {
        feedback.error(e instanceof Error ? e.message : 'Could not record the items');
        return;
      }
      try {
        await configRef.current.finish(pending.name);
      } catch {
        return; // finish reports its own failure
      }
      setPending(null);
      if (result.not_seen_leaving.length) {
        feedback.warning('Not seen leaving: ' + result.not_seen_leaving.join(', '));
      }
    } finally {
      setSaving(false);
    }
  }

  function onConfirm() {
    if (!pending) return;
    const missing = pending.items.filter((i) => !ticked.includes(i.name ?? ''));
    if (!missing.length) {
      complete();
      return;
    }
    Alert.alert(
      missing.length === 1 ? '1 item not ticked' : String(missing.length) + ' items not ticked',
      missing.map((i) => '• ' + i.item + ' (' + i.carried_by + ')').join('\n') +
        '\n\nThese will be recorded as not seen leaving.',
      [
        { text: 'Go back', style: 'cancel' },
        { text: 'Check out anyway', style: 'destructive', onPress: complete },
      ],
    );
  }

  const toggle = (rowName: string) =>
    setTicked((t) => (t.includes(rowName) ? t.filter((n) => n !== rowName) : [...t, rowName]));

  const sheet = (
    <Modal
      visible={pending != null}
      transparent
      animationType="slide"
      onRequestClose={() => !saving && setPending(null)}
    >
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Ionicons name="bag-check-outline" size={22} color={COLORS.text} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={s.title}>Items leaving with {pending?.ownerName ?? 'visitor'}</Text>
              <Text style={s.subtitle}>Tick each item you see going out.</Text>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 360 }}>
            {pending?.items.map((it) => {
              const rowName = it.name ?? '';
              const on = ticked.includes(rowName);
              return (
                <TouchableOpacity
                  key={rowName}
                  onPress={() => toggle(rowName)}
                  disabled={saving}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[s.row, on ? s.rowOn : null]}
                >
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={on ? COLORS.success : COLORS.textMuted}
                  />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={s.itemName}>
                      {it.item}
                      {it.qty && it.qty > 1 ? ' ×' + String(it.qty) : ''}
                    </Text>
                    <Text style={s.itemMeta}>
                      {it.carried_by}
                      {it.serial_notes ? ' · ' + it.serial_notes : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={() => setTicked(pending?.items.map((i) => i.name ?? '') ?? [])}
            disabled={saving}
            style={s.tickAll}
          >
            <Text style={s.tickAllText}>Tick all</Text>
          </TouchableOpacity>

          <View style={s.actions}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setPending(null)}
              disabled={saving}
              style={{ flex: 1 }}
            />
            <Button
              label="CHECK OUT"
              iconLeft="log-out-outline"
              onPress={onConfirm}
              loading={saving}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  return { begin, sheet, busy: saving, loadingName };
}

const s = {
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' as const },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.md,
  },
  title: { fontSize: fontSize.md, fontFamily: fontFamily.semiBold, color: COLORS.text },
  subtitle: { fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowOn: { borderColor: COLORS.success },
  itemName: { fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, color: COLORS.text },
  itemMeta: { fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
  tickAll: { alignSelf: 'flex-end' as const, paddingVertical: spacing.sm },
  tickAllText: { fontSize: fontSize.sm, color: COLORS.primary, fontFamily: fontFamily.semiBold },
  actions: { flexDirection: 'row' as const, gap: spacing.sm, marginTop: spacing.sm },
};
