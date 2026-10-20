import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/core/ui/Button';
import type { VisitCarriedItem } from '@/lib/services/api';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

type NewItem = { key: string; item: string; qty: string };

/**
 * Coming back in: tick the person's items that went out with them and are
 * back, and add anything new they bring. Used for a contractor's badge entry
 * at a farm and a staff member returning from a step-out.
 */
export function EntryItemsSheet({
  entry,
  onClose,
  onSave,
  hint = 'Tick what they brought back in, and add anything new.',
  emptyText = 'No items left with them earlier.',
  skipLabel = 'Skip',
  saveLabel = 'Record items',
  onSkip,
}: {
  entry: { key: string; holder: string; items: VisitCarriedItem[] } | null;
  onClose: () => void;
  // Record it (throw to keep the sheet open); the caller reports success.
  onSave: (ticked: string[], newItems: { item: string; qty: number }[]) => Promise<void>;
  hint?: string;
  emptyText?: string | null;
  skipLabel?: string;
  saveLabel?: string;
  // Defaults to closing; a check-in passes "go on without items".
  onSkip?: () => void;
}) {
  const feedback = useFeedback();
  const [ticked, setTicked] = useState<string[]>([]);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [saving, setSaving] = useState(false);
  const key = entry?.key;

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
      await onSave(ticked, add);
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
            {hint}
          </Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {entry && !entry.items.length && emptyText ? (
              <Text style={{ fontSize: fontSize.sm, color: COLORS.textMuted }}>{emptyText}</Text>
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
            <Button label={skipLabel} variant="outline" onPress={onSkip ?? onClose} disabled={saving} style={{ flex: 1 }} />
            <Button label={saveLabel} iconLeft="log-in-outline" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
