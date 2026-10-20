import { useRef, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { ExitExtraItem } from '@/lib/services/api';
import { uploadIncidentPhoto } from '@/lib/api/incidents';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';

/**
 * Items leaving that were not registered on the way in - a staff member
 * who bought something from the company, a return, a gate pass. Each needs
 * proof: the delivery note / document number (scanned or typed - the
 * server checks a Delivery Note or Sales Invoice is submitted) or a photo
 * of the document. Used inside the exit checklist for visits, staff and
 * contractor badges.
 */
export type ExtraDraft = { key: string; item: string; qty: string; document: string; photoUri: string | null };

export const newExtra = (): ExtraDraft => ({
  key: Math.random().toString(36).slice(2),
  item: '',
  qty: '1',
  document: '',
  photoUri: null,
});

/** Upload the photos and shape the drafts for the server. Throws a message
 *  a guard can act on (missing proof, failed upload). */
export async function extrasPayload(extras: ExtraDraft[]): Promise<ExitExtraItem[]> {
  const out: ExitExtraItem[] = [];
  for (const x of extras.filter((e) => e.item.trim())) {
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
      qty: Math.max(parseInt(x.qty, 10) || 1, 1),
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
  const [permission, requestPermission] = useCameraPermissions();
  const [scanFor, setScanFor] = useState<string | null>(null);
  const scanned = useRef(false);
  const update = (key: string, patch: Partial<ExtraDraft>) =>
    onChange(extras.map((x) => (x.key === key ? { ...x, ...patch } : x)));

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
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
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
              onChangeText={(v) => update(x.key, { qty: v.replace(/[^0-9]/g, '') })}
              placeholder="Qty"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              editable={!disabled}
              style={[s.input, { width: 64 }]}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, alignItems: 'center' }}>
            <TextInput
              value={x.document}
              onChangeText={(v) => update(x.key, { document: v })}
              placeholder="Delivery note / document number"
              placeholderTextColor={COLORS.textMuted}
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
              update(scanFor, { document: documentFromScan(data) });
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

const s = {
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
