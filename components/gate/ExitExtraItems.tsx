import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api, type DispatchExpectedItem, type ExitExtraItem } from '@/lib/services/api';
import { uploadIncidentPhoto } from '@/lib/api/incidents';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { useFeatureFlag } from '@/lib/hooks/useSessionInfo';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';

/**
 * Items leaving that were not registered on the way in - a staff member
 * who bought something from the company, a return, a gate pass. Each needs
 * proof: the delivery note / document number (scanned or typed - the
 * server checks a Delivery Note or Sales Invoice is submitted) or a photo
 * of the document. Used inside the exit checklist for visits, staff and
 * contractor badges.
 *
 * A document number that is a Delivery Note in the system is fetched the
 * same way the Dispatch Check does: its lines replace the free-text item,
 * each with its expected qty and a box for what the guard counts leaving.
 * Those counts go to the note's Dispatch Check (Matches / Short / Over).
 */
export type DeliveryNoteDraft = {
  name: string;
  lines: DispatchExpectedItem[];
  /** Already cleared at the truck gate: the counts are kept on the items
   *  but the server will not make a second Dispatch Check. */
  alreadyVerified: boolean;
};

export type ExtraDraft = {
  key: string;
  item: string;
  qty: string;
  document: string;
  photoUri: string | null;
  /** The Delivery Note the document number found, if it is one. */
  note: DeliveryNoteDraft | null;
  /** What the guard counted leaving, by the note's row_id. */
  counts: Record<string, string>;
  /** The document number last looked up, so it is fetched once. */
  lookedUp: string;
  lookingUp: boolean;
};

export const newExtra = (): ExtraDraft => ({
  key: Math.random().toString(36).slice(2),
  item: '',
  qty: '1',
  document: '',
  photoUri: null,
  note: null,
  counts: {},
  lookedUp: '',
  lookingUp: false,
});

/** A count the guard typed: decimals allowed (2.5 kg), one decimal point. */
const cleanQty = (v: string) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

export function lineStatus(expected: number, counted: string): 'Matches' | 'Short' | 'Over' | null {
  if (counted.trim() === '') return null;
  const actual = Math.round(parseFloat(counted) * 100) / 100;
  const want = Math.round(expected * 100) / 100;
  if (Number.isNaN(actual)) return null;
  return actual === want ? 'Matches' : actual < want ? 'Short' : 'Over';
}

/** Upload the photos and shape the drafts for the server. Throws a message
 *  a guard can act on (missing proof, failed upload). */
export async function extrasPayload(extras: ExtraDraft[]): Promise<ExitExtraItem[]> {
  const out: ExitExtraItem[] = [];
  for (const x of extras) {
    if (!x.item.trim() && !x.note) {
      if (x.lookingUp) throw new Error(`${x.document.trim()}: still checking the delivery note - try again`);
      if (x.document.trim()) throw new Error(`${x.document.trim()}: say what is leaving`);
      continue;
    }
    if (x.note) {
      const item_checks = x.note.lines
        .filter((l) => (x.counts[l.row_id] ?? '').trim() !== '')
        .map((l) => ({ row_id: l.row_id, actual_qty: parseFloat(x.counts[l.row_id]) || 0 }));
      if (!item_checks.length) {
        throw new Error(`Delivery Note ${x.note.name}: count what is leaving on each line`);
      }
      let noteFile: string | undefined;
      if (x.photoUri) {
        try {
          noteFile = await uploadIncidentPhoto(x.photoUri, 'exit-document-' + Date.now() + '.jpg');
        } catch (e) {
          throw new Error('Could not upload the document photo - ' + (e instanceof Error ? e.message : String(e)));
        }
      }
      // item / qty: what a server older than item_checks records instead.
      const counted = x.note.lines
        .filter((l) => parseFloat(x.counts[l.row_id]) > 0)
        .map((l) => `${l.item_name || l.item_code} x${parseFloat(x.counts[l.row_id])}`);
      out.push({
        item: counted.join(', ') || 'Goods on Delivery Note ' + x.note.name,
        qty: 1,
        supporting_document: x.note.name,
        supporting_document_file: noteFile,
        item_checks,
      });
      continue;
    }
    if (!x.document.trim() && !x.photoUri) {
      throw new Error(`${x.item.trim()}: scan or enter the delivery note / document number, or photograph it`);
    }
    let fileUrl: string | undefined;
    if (x.photoUri) {
      try {
        fileUrl = await uploadIncidentPhoto(x.photoUri, 'exit-document-' + Date.now() + '.jpg');
      } catch (e) {
        throw new Error('Could not upload the document photo - ' + (e instanceof Error ? e.message : String(e)));
      }
    }
    out.push({
      item: x.item.trim(),
      qty: parseFloat(x.qty) > 0 ? parseFloat(x.qty) : 1,
      supporting_document: x.document.trim() || undefined,
      supporting_document_file: fileUrl,
    });
  }
  return out;
}

// A scanned Frappe QR is a URL ending in the document name
// (.../app/delivery-note/MAT-DN-2026-00012); a barcode is the number itself.
function documentFromScan(data: string): string {
  const v = (data || '').trim();
  if (!v.includes('/')) return v;
  return decodeURIComponent(v.replace(/\/+$/, '').split('/').pop() || v);
}

export function ExitExtraItems({
  extras,
  onChange,
  disabled,
}: {
  extras: ExtraDraft[];
  onChange: (next: ExtraDraft[]) => void;
  disabled?: boolean;
}) {
  const feedback = useFeedback();
  const dispatchOn = useFeatureFlag('feature_gate_dispatch');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanFor, setScanFor] = useState<string | null>(null);
  const scanned = useRef(false);
  // The lookup finishes after other edits - always patch the latest list.
  const latest = useRef(extras);
  latest.current = extras;
  const update = (key: string, patch: Partial<ExtraDraft>) => {
    latest.current = latest.current.map((x) => (x.key === key ? { ...x, ...patch } : x));
    onChange(latest.current);
  };

  // Fetch the document like the Dispatch Check does. Anything that is not a
  // Delivery Note here (a paper gate pass, an invoice, dispatch switched off)
  // keeps the free-text item and qty.
  async function lookUp(key: string, number: string) {
    const ref = number.trim();
    const draft = latest.current.find((x) => x.key === key);
    if (!dispatchOn || !ref || !draft || draft.lookedUp === ref) return;
    update(key, { lookingUp: true, lookedUp: ref });
    let note: DeliveryNoteDraft | null = null;
    try {
      const r = await api.searchDispatchForGate(ref);
      if (r.found && r.reference_doctype === 'Delivery Note' && r.expected_items?.length) {
        note = { name: r.reference_name, lines: r.expected_items, alreadyVerified: !!r.already_verified };
      }
    } catch {
      // treated as not a Delivery Note
    }
    const still = latest.current.find((x) => x.key === key);
    if (!still || still.document.trim() !== ref) return update(key, { lookingUp: false });
    update(key, { lookingUp: false, note, counts: {} });
  }

  async function startScan(key: string) {
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) {
        feedback.warning('Camera permission is needed to scan the document');
        return;
      }
    }
    scanned.current = false;
    setScanFor(key);
  }

  async function takePhoto(key: string) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      feedback.warning('Camera permission is needed to photograph the document');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
    if (!r.canceled && r.assets[0]) update(key, { photoUri: r.assets[0].uri });
  }

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={s.sectionTitle}>Leaving with something not registered?</Text>
      <Text style={s.hint}>
        Something bought from the company, a return or a gate pass. Scan or enter its delivery note / document number,
        photograph the document, or both.
      </Text>
      {extras.map((x, idx) => (
        <View key={x.key} style={s.extraCard}>
          <View style={s.extraHead}>
            <Text style={s.itemName}>Item {idx + 1}</Text>
            <TouchableOpacity
              onPress={() => onChange(extras.filter((y) => y.key !== x.key))}
              disabled={disabled}
              hitSlop={8}
              accessibilityLabel={'Remove item ' + String(idx + 1)}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <TextInput
              value={x.document}
              onChangeText={(v) =>
                update(
                  x.key,
                  v.trim() === x.note?.name ? { document: v } : { document: v, note: null, counts: {}, lookedUp: '' },
                )
              }
              onEndEditing={(e) => lookUp(x.key, e.nativeEvent.text)}
              onSubmitEditing={(e) => lookUp(x.key, e.nativeEvent.text)}
              placeholder="Delivery note / document number"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="characters"
              editable={!disabled}
              style={[s.input, { flex: 1 }]}
            />
            <TouchableOpacity
              onPress={() => startScan(x.key)}
              disabled={disabled}
              style={s.scanBtn}
              accessibilityLabel="Scan the document"
            >
              <Ionicons name="qr-code-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {x.lookingUp ? (
            <View style={s.lookupRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={[s.hint, { marginLeft: 6, marginBottom: 0 }]}>Checking the delivery note…</Text>
            </View>
          ) : x.note ? (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={s.noteTitle}>Delivery Note {x.note.name} - count what is leaving</Text>
              {x.note.alreadyVerified ? (
                <Text style={[s.hint, { color: COLORS.warn }]}>Already cleared at the dispatch gate.</Text>
              ) : null}
              {x.note.lines.map((l) => {
                const counted = x.counts[l.row_id] ?? '';
                const status = lineStatus(l.qty, counted);
                return (
                  <View key={l.row_id} style={s.lineRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName} numberOfLines={2}>
                        {l.item_name || l.item_code}
                      </Text>
                      <Text style={s.hint}>
                        Expected {l.qty} {l.uom || ''}
                        {status ? '  ·  ' : ''}
                        {status ? (
                          <Text style={{ color: STATUS_COLOR[status], fontFamily: fontFamily.semiBold }}>{status}</Text>
                        ) : null}
                      </Text>
                    </View>
                    <TextInput
                      value={counted}
                      onChangeText={(v) => update(x.key, { counts: { ...x.counts, [l.row_id]: cleanQty(v) } })}
                      placeholder="Actual"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                      editable={!disabled}
                      accessibilityLabel={'Actual quantity of ' + (l.item_name || l.item_code)}
                      style={[
                        s.input,
                        { width: 80 },
                        status && status !== 'Matches' ? { borderColor: STATUS_COLOR[status] } : null,
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <TextInput
                value={x.item}
                onChangeText={(v) => update(x.key, { item: v })}
                placeholder="What is it?"
                placeholderTextColor={COLORS.textMuted}
                editable={!disabled}
                style={[s.input, { flex: 1 }]}
              />
              <TextInput
                value={x.qty}
                onChangeText={(v) => update(x.key, { qty: cleanQty(v) })}
                placeholder="Qty"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                editable={!disabled}
                style={[s.input, { width: 64 }]}
              />
            </View>
          )}
          <TouchableOpacity onPress={() => takePhoto(x.key)} disabled={disabled} style={s.photoBtn}>
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
      <TouchableOpacity onPress={() => onChange([...extras, newExtra()])} disabled={disabled} style={s.addBtn}>
        <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
        <Text style={[s.link, { marginLeft: 6 }]}>Add an item leaving</Text>
      </TouchableOpacity>

      <Modal visible={scanFor != null} animationType="slide" onRequestClose={() => setScanFor(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'datamatrix', 'pdf417'] }}
            onBarcodeScanned={({ data }) => {
              if (scanned.current || !scanFor) return;
              scanned.current = true;
              const number = documentFromScan(data);
              update(scanFor, { document: number, note: null, counts: {}, lookedUp: '' });
              lookUp(scanFor, number);
              setScanFor(null);
            }}
          />
          <View style={s.scanFooter}>
            <Text style={{ color: '#fff', marginBottom: spacing.sm }}>Scan the code on the delivery note</Text>
            <TouchableOpacity onPress={() => setScanFor(null)} style={s.scanCancel}>
              <Text style={{ color: '#000', fontFamily: fontFamily.semiBold }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const STATUS_COLOR = { Matches: COLORS.success, Short: COLORS.warn, Over: COLORS.danger };

const s = {
  noteTitle: { fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, color: COLORS.text, marginBottom: spacing.xs },
  lineRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  lookupRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: spacing.sm },
  sectionTitle: { fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, color: COLORS.text },
  hint: { fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2, marginBottom: spacing.sm },
  itemName: { fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, color: COLORS.text },
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
  scanBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.md,
    padding: 8,
  },
  photoBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: spacing.sm },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: spacing.sm },
  scanFooter: { position: 'absolute' as const, bottom: 40, left: 0, right: 0, alignItems: 'center' as const },
  scanCancel: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
};
