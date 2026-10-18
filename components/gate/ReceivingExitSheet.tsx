import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '@/src/core/ui/Button';
import { api, type ReceivingDeparture, type ReceivingExitCheck, type ReceivingReceiptCheck } from '@/lib/services/api';
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

type ProofMode = 'receipt' | 'deliveryNote' | 'none';
type CheckedReceipt = Extract<ReceivingReceiptCheck, { receipt: string }>;

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
 *
 * Proof of delivery (newer servers): the goods receipt note the driver was
 * given - scanned or typed, checked against this truck - or, when stores
 * have not posted it yet, the supplier's delivery note number (the server
 * links the receipt later), or why nothing was received.
 */
export function ReceivingExitSheet({ name, onClose, onConfirm }: Props) {
  const feedback = useFeedback();
  const [data, setData] = useState<ReceivingDeparture | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  const [extras, setExtras] = useState<ExtraDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [proof, setProof] = useState<ProofMode>('receipt');
  const [receipts, setReceipts] = useState<CheckedReceipt[]>([]);
  const [receiptInput, setReceiptInput] = useState('');
  const [checkingReceipt, setCheckingReceipt] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [reason, setReason] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  useEffect(() => {
    setData(null);
    setTicked([]);
    setExtras([]);
    setProof('receipt');
    setReceipts([]);
    setReceiptInput('');
    setScanning(false);
    setDeliveryNote('');
    setReason('');
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

  async function addReceipt(reference: string) {
    if (!name || !reference.trim()) return;
    setCheckingReceipt(true);
    try {
      const r = await api.checkReceivingReceipt(name, reference.trim());
      if ('error' in r && r.error) {
        feedback.error(r.error);
      } else {
        const ok = r as CheckedReceipt;
        setReceipts((xs) => (xs.some((x) => x.receipt === ok.receipt) ? xs : [...xs, ok]));
        setReceiptInput('');
        feedback.success(`Receipt ${ok.receipt} matches this delivery`);
      }
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Could not check the receipt');
    } finally {
      setCheckingReceipt(false);
    }
  }

  async function startScan() {
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) {
        feedback.warning('Camera permission is needed to scan the receipt');
        return;
      }
    }
    scannedRef.current = false;
    setScanning(true);
  }

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
      const exit: ReceivingExitCheck = { items_out: ticked, extra_items: extraItems };
      if (data?.receipt_required) {
        if (proof === 'receipt') exit.receipts = receipts.map((r) => r.receipt);
        else if (proof === 'deliveryNote') exit.supplier_delivery_note = deliveryNote.trim();
        else exit.no_receipt_reason = reason.trim();
      }
      await onConfirm(name, exit);
      onClose();
    } catch {
      // the departure hook reports its own failure; the sheet stays open
    } finally {
      setSaving(false);
    }
  }

  function onCheckOut() {
    if (data?.receipt_required) {
      const missingProof =
        proof === 'receipt'
          ? !receipts.length && 'Scan or enter the goods receipt note the driver was given.'
          : proof === 'deliveryNote'
            ? !deliveryNote.trim() && "Enter the number on the supplier's delivery note."
            : !reason.trim() && 'Say why nothing was received.';
      if (missingProof) {
        Alert.alert('Proof of delivery', missingProof);
        return;
      }
    }
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
            <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
              {data?.receipt_required ? (
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={s.section}>Proof of delivery</Text>
                  <View style={s.modes}>
                    {(
                      [
                        ['receipt', 'Receipt note'],
                        ['deliveryNote', 'Not issued yet'],
                        ['none', 'Nothing received'],
                      ] as [ProofMode, string][]
                    ).map(([m, label]) => (
                      <TouchableOpacity
                        key={m}
                        onPress={() => {
                          setProof(m);
                          setScanning(false);
                        }}
                        disabled={saving}
                        style={[s.mode, proof === m ? s.modeOn : null]}
                      >
                        <Text style={[s.modeText, proof === m ? s.modeTextOn : null]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {proof === 'receipt' ? (
                    <>
                      <Text style={s.hint}>Scan the QR on the goods received note stores gave the driver, or type its number.</Text>
                      {scanning ? (
                        <View style={s.camera}>
                          <CameraView
                            style={{ flex: 1 }}
                            facing="back"
                            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }}
                            onBarcodeScanned={({ data: code }) => {
                              if (scannedRef.current) return;
                              scannedRef.current = true;
                              setScanning(false);
                              addReceipt(code);
                            }}
                          />
                        </View>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => (scanning ? setScanning(false) : startScan())} disabled={saving} style={s.scanBtn}>
                          <Ionicons name={scanning ? 'close' : 'qr-code-outline'} size={18} color={COLORS.textOnPrimary} />
                          <Text style={s.scanBtnText}>{scanning ? 'Stop' : 'Scan'}</Text>
                        </TouchableOpacity>
                        <TextInput
                          value={receiptInput}
                          onChangeText={setReceiptInput}
                          placeholder="e.g. MAT-PRE-2026-03739"
                          placeholderTextColor={COLORS.textMuted}
                          autoCapitalize="characters"
                          editable={!saving && !checkingReceipt}
                          onSubmitEditing={() => addReceipt(receiptInput)}
                          style={[s.input, { flex: 1 }]}
                        />
                        <TouchableOpacity onPress={() => addReceipt(receiptInput)} disabled={!receiptInput.trim() || checkingReceipt} hitSlop={8}>
                          {checkingReceipt ? (
                            <ActivityIndicator size="small" color={COLORS.primary} />
                          ) : (
                            <Ionicons name="arrow-forward-circle" size={26} color={receiptInput.trim() ? COLORS.primary : COLORS.textMuted} />
                          )}
                        </TouchableOpacity>
                      </View>
                      {receipts.map((r) => (
                        <View key={r.receipt} style={s.receiptRow}>
                          <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                          <View style={{ flex: 1, marginLeft: spacing.sm }}>
                            <Text style={s.itemName}>{r.receipt}</Text>
                            <Text style={s.itemMeta}>
                              {r.purchase_orders.join(', ')} · {r.items} item{r.items === 1 ? '' : 's'}
                              {r.submitted ? '' : ' · not yet submitted by stores'}
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => setReceipts((xs) => xs.filter((x) => x.receipt !== r.receipt))} hitSlop={8}>
                            <Ionicons name="close-circle-outline" size={20} color={COLORS.textMuted} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  ) : proof === 'deliveryNote' ? (
                    <>
                      <Text style={s.hint}>
                        Stores have not issued the receipt yet. Enter the number on the supplier&apos;s delivery note —
                        the receipt is linked when stores post it, and security is alerted if it never comes.
                      </Text>
                      <TextInput
                        value={deliveryNote}
                        onChangeText={setDeliveryNote}
                        placeholder="Supplier delivery note number"
                        placeholderTextColor={COLORS.textMuted}
                        autoCapitalize="characters"
                        editable={!saving}
                        style={s.input}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={s.hint}>Load rejected or nothing offloaded? Say why — security is notified.</Text>
                      <TextInput
                        value={reason}
                        onChangeText={setReason}
                        placeholder="e.g. Load rejected — wrong specification"
                        placeholderTextColor={COLORS.textMuted}
                        editable={!saving}
                        multiline
                        style={[s.input, { minHeight: 56, textAlignVertical: 'top' }]}
                      />
                    </>
                  )}
                </View>
              ) : null}

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
  modes: { flexDirection: 'row' as const, gap: spacing.xs, marginTop: spacing.xs, marginBottom: spacing.xs },
  mode: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    alignItems: 'center' as const,
  },
  modeOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  modeText: { fontSize: fontSize.xs, fontFamily: fontFamily.semiBold, color: COLORS.text },
  modeTextOn: { color: COLORS.textOnPrimary },
  camera: { height: 220, borderRadius: borderRadius.md, overflow: 'hidden' as const, marginBottom: spacing.sm },
  scanBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: COLORS.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  scanBtnText: { color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, marginLeft: 4 },
  receiptRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  photoBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: spacing.sm },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: spacing.sm },
  actions: { flexDirection: 'row' as const, gap: spacing.sm, marginTop: spacing.sm },
};
