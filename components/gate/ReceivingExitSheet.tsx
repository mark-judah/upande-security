import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/src/core/ui/Button';
import { api, type ReceivingDeparture, type ReceivingExitCheck } from '@/lib/services/api';
import { uploadIncidentPhoto } from '@/lib/api/incidents';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';

// Something leaving that was not declared on the way in. photoUri is the
// local camera shot; photoUrl the uploaded file once sent.
type ExtraDraft = { key: string; item: string; qty: string; document: string; photoUri: string | null };

let extraSeq = 0;
const newExtra = (): ExtraDraft => {
  extraSeq += 1;
  return { key: 'x' + String(extraSeq), item: '', qty: '1', document: '', photoUri: null };
};

type Props = {
  // Gate Receiving Verification name of the truck, or null when closed.
  name: string | null;
  onClose: () => void;
  onConfirm: (name: string, exit: ReceivingExitCheck) => Promise<unknown>;
};

/**
 * Exit check for a supplier truck: tick each item declared at entry that is
 * leaving, and record anything else leaving that was NOT declared - each of
 * those needs a supporting document (a reference number, a photo of it, or
 * both). The server refuses the departure without one, so the check is
 * enforced here first to keep the guard from losing what they typed.
 */
export function ReceivingExitSheet({ name, onClose, onConfirm }: Props) {
  const feedback = useFeedback();
  const [data, setData] = useState<ReceivingDeparture | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  const [extras, setExtras] = useState<ExtraDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setData(null);
    setTicked([]);
    setExtras([]);
    if (!name) return;
    setLoading(true);
    api
      .getReceivingDeparture(name)
      .then(setData)
      .catch((e) => {
        feedback.error(e instanceof Error ? e.message : 'Could not load the delivery');
        onClose();
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const toggle = (row: string) => setTicked((t) => (t.includes(row) ? t.filter((n) => n !== row) : [...t, row]));
  const updateExtra = (key: string, patch: Partial<ExtraDraft>) =>
    setExtras((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function takePhoto(key: string) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      feedback.warning('Camera permission is needed to photograph the document');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
    if (!r.canceled && r.assets[0]) updateExtra(key, { photoUri: r.assets[0].uri });
  }

  async function submit() {
    if (!name) return;
    setSaving(true);
    try {
      const extraItems = [];
      for (const x of extras.filter((e) => e.item.trim())) {
        let fileUrl: string | undefined;
        if (x.photoUri) {
          try {
            fileUrl = await uploadIncidentPhoto(x.photoUri, 'supplier-exit-' + Date.now() + '.jpg');
          } catch (e) {
            feedback.error('Could not upload the document photo - ' + (e instanceof Error ? e.message : String(e)));
            return;
          }
        }
        extraItems.push({
          item: x.item.trim(),
          qty: Math.max(parseInt(x.qty, 10) || 1, 1),
          supporting_document: x.document.trim(),
          supporting_document_file: fileUrl,
        });
      }
      await onConfirm(name, { items_out: ticked, extra_items: extraItems });
      onClose();
    } catch {
      // the departure hook reports its own failure; the sheet stays open
    } finally {
      setSaving(false);
    }
  }

  function onCheckOut() {
    const filled = extras.filter((x) => x.item.trim());
    const noDocument = filled.filter((x) => !x.document.trim() && !x.photoUri);
    if (noDocument.length) {
      Alert.alert(
        'Supporting document needed',
        noDocument.map((x) => '• ' + x.item.trim()).join('\n') +
          '\n\nThese were not declared on the way in. Enter the document number or photograph the document before the truck leaves.',
      );
      return;
    }
    const missing = (data?.items ?? []).filter((i) => !ticked.includes(i.name ?? ''));
    if (!missing.length) {
      submit();
      return;
    }
    Alert.alert(
      missing.length === 1 ? '1 item not ticked' : String(missing.length) + ' items not ticked',
      missing.map((i) => '• ' + i.item).join('\n') + '\n\nThese will be recorded as not seen leaving.',
      [
        { text: 'Go back', style: 'cancel' },
        { text: 'Check out anyway', style: 'destructive', onPress: submit },
      ],
    );
  }

  return (
    <Modal visible={name != null} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Ionicons name="bag-check-outline" size={22} color={COLORS.text} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={s.title}>Leaving: {data?.supplier_name ?? 'supplier'}</Text>
              <Text style={s.subtitle}>
                {[data?.vehicle_no, data?.driver_name].filter(Boolean).join(' · ') || 'Check what is on the truck.'}
              </Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: spacing.lg }} />
          ) : (
            <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
              <Text style={s.section}>Declared on the way in</Text>
              {data?.items.length ? (
                <>
                  <Text style={s.hint}>Tick each item you see leaving with the truck.</Text>
                  {data.items.map((it) => {
                    const row = it.name ?? '';
                    const on = ticked.includes(row);
                    return (
                      <TouchableOpacity
                        key={row}
                        onPress={() => toggle(row)}
                        disabled={saving}
                        activeOpacity={0.7}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        style={[s.row, on ? s.rowOn : null]}
                      >
                        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? COLORS.success : COLORS.textMuted} />
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text style={s.itemName}>
                            {it.item}
                            {it.qty && it.qty > 1 ? ' ×' + String(it.qty) : ''}
                          </Text>
                          {it.serial_notes ? <Text style={s.itemMeta}>{it.serial_notes}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    onPress={() => setTicked(data.items.map((i) => i.name ?? ''))}
                    disabled={saving}
                    style={s.tickAll}
                  >
                    <Text style={s.link}>Tick all</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={s.hint}>Nothing was declared on the way in.</Text>
              )}

              <Text style={[s.section, { marginTop: spacing.md }]}>Anything else leaving?</Text>
              <Text style={s.hint}>
                Goods leaving that were not declared on the way in must have a supporting document - a delivery
                note, gate pass or return note. Enter its number, photograph it, or both.
              </Text>
              {extras.map((x, idx) => (
                <View key={x.key} style={s.extraCard}>
                  <View style={s.extraHead}>
                    <Text style={s.itemName}>Item {idx + 1}</Text>
                    <TouchableOpacity
                      onPress={() => setExtras((xs) => xs.filter((y) => y.key !== x.key))}
                      disabled={saving}
                      hitSlop={8}
                      accessibilityLabel={'Remove item ' + String(idx + 1)}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <TextInput
                      value={x.item}
                      onChangeText={(v) => updateExtra(x.key, { item: v })}
                      placeholder="What is it?"
                      placeholderTextColor={COLORS.textMuted}
                      editable={!saving}
                      style={[s.input, { flex: 1 }]}
                    />
                    <TextInput
                      value={x.qty}
                      onChangeText={(v) => updateExtra(x.key, { qty: v.replace(/[^0-9]/g, '') })}
                      placeholder="Qty"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      editable={!saving}
                      style={[s.input, { width: 64 }]}
                    />
                  </View>
                  <TextInput
                    value={x.document}
                    onChangeText={(v) => updateExtra(x.key, { document: v })}
                    placeholder="Document number (delivery note, gate pass...)"
                    placeholderTextColor={COLORS.textMuted}
                    editable={!saving}
                    style={[s.input, { marginTop: spacing.xs }]}
                  />
                  <TouchableOpacity onPress={() => takePhoto(x.key)} disabled={saving} style={s.photoBtn}>
                    <Ionicons
                      name={x.photoUri ? 'checkmark-circle' : 'camera-outline'}
                      size={18}
                      color={x.photoUri ? COLORS.success : COLORS.primary}
                    />
                    <Text style={[s.link, { marginLeft: 6, color: x.photoUri ? COLORS.success : COLORS.primary }]}>
                      {x.photoUri ? 'Document photo attached - retake' : 'Photograph the document'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setExtras((xs) => [...xs, newExtra()])}
                disabled={saving}
                style={s.addBtn}
              >
                <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                <Text style={[s.link, { marginLeft: 6 }]}>Add an item that was not declared</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          <View style={s.actions}>
            <Button label="Cancel" variant="outline" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
            <Button
              label="CONFIRM DEPARTURE"
              iconLeft="log-out-outline"
              onPress={onCheckOut}
              loading={saving}
              disabled={loading || !data}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
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
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: spacing.md },
  title: { fontSize: fontSize.md, fontFamily: fontFamily.semiBold, color: COLORS.text },
  subtitle: { fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
  section: { fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, color: COLORS.text },
  hint: { fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2, marginBottom: spacing.sm },
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
  tickAll: { alignSelf: 'flex-end' as const, paddingVertical: spacing.xs },
  link: { fontSize: fontSize.sm, color: COLORS.primary, fontFamily: fontFamily.semiBold },
  extraCard: {
    borderWidth: 1,
    borderColor: COLORS.warn,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  extraHead: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: fontSize.sm,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  photoBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: spacing.sm },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: spacing.sm },
  actions: { flexDirection: 'row' as const, gap: spacing.sm, marginTop: spacing.sm },
};
