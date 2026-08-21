import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useGateStore } from '@/lib/stores/gateStore';
import { useScanAsset } from '@/lib/hooks/useScanAsset';
import { useReportAssetMissing } from '@/lib/hooks/useReportAssetMissing';
import { useAssetsAtFarm } from '@/lib/hooks/useAssetsAtFarm';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { fmtDateTime } from '@/lib/utils/date';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { Card } from '@/src/core/ui/Card';
import { COLORS, borderRadius, fontSize, spacing } from '@/src/core/theme';
import type { ScanAssetResult, KnownAsset } from '@/lib/services/api';

async function captureGps(): Promise<{ latitude: number; longitude: number; accuracy: number | null } | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}

export default function AssetScanScreen() {
  const feedback = useFeedback();
  const pendingScannedAsset = useGateStore((s) => s.pendingScannedAsset);
  const setPendingScannedAsset = useGateStore((s) => s.setPendingScannedAsset);
  const scanAsset = useScanAsset();
  const reportMissing = useReportAssetMissing();
  const assetsQuery = useAssetsAtFarm();

  const [lastResult, setLastResult] = useState<ScanAssetResult | null>(null);
  const [locating, setLocating] = useState(false);

  const [missingPickerOpen, setMissingPickerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<KnownAsset | null>(null);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!pendingScannedAsset) return;
    const code = pendingScannedAsset;
    setPendingScannedAsset(null);
    (async () => {
      setLocating(true);
      try {
        const gps = await captureGps();
        if (!gps) {
          feedback.warning('Location permission is required to log a scan');
          return;
        }
        const result = await scanAsset.mutateAsync({
          asset_code: code,
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracy: gps.accuracy,
        });
        setLastResult(result);
      } catch {
        // useScanAsset already surfaces the error via feedback
      } finally {
        setLocating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScannedAsset]);

  const openMissingPicker = () => {
    setSelectedAsset(null);
    setRemarks('');
    setMissingPickerOpen(true);
  };

  const submitMissing = async () => {
    if (!selectedAsset) return;
    try {
      const gps = await captureGps();
      await reportMissing.mutateAsync({
        asset_code: selectedAsset.asset_code,
        latitude: gps?.latitude,
        longitude: gps?.longitude,
        accuracy: gps?.accuracy,
        remarks: remarks.trim() || undefined,
      });
      setMissingPickerOpen(false);
    } catch {
      // useReportAssetMissing already surfaces the error
    }
  };

  const busy = locating || scanAsset.isPending;

  return (
    <Screen title="Assets" loading={false}>
      <Text style={s.subtitle}>
        Scan the QR sticker on a physical asset to confirm it&apos;s here. Location is captured
        automatically and refines over time as more scans come in.
      </Text>

      <Card style={s.actionCard}>
        <View style={s.iconCircle}>
          <Ionicons name="qr-code-outline" size={32} color={COLORS.textOnPrimary} />
        </View>
        <Button
          label="SCAN ASSET QR"
          iconLeft="camera-outline"
          onPress={() => router.push('/scan?intent=asset')}
          loading={busy}
          disabled={busy}
          style={s.scanBtn}
        />
      </Card>

      {locating ? (
        <Card style={s.resultCard}>
          <ActivityIndicator color={COLORS.text} />
          <Text style={s.resultHint}>Getting your location…</Text>
        </Card>
      ) : null}

      {lastResult && !locating ? (
        <Card style={s.resultCard}>
          <View style={s.resultHeader}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={s.resultTitle}>
              {lastResult.is_new ? 'New asset registered' : 'Confirmed present'}
            </Text>
          </View>
          <Text style={s.resultCode}>{lastResult.asset_code}</Text>
          {lastResult.farm ? <Text style={s.resultDetail}>Farm: {lastResult.farm}</Text> : null}
          <Text style={s.resultDetail}>
            Location samples so far: {lastResult.location_sample_count}
          </Text>
        </Card>
      ) : null}

      <Button
        label="REPORT ASSET MISSING"
        iconLeft="alert-circle-outline"
        variant="outline"
        onPress={openMissingPicker}
        style={s.missingBtn}
      />

      <Modal
        visible={missingPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMissingPickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {selectedAsset ? 'Confirm missing' : 'Which asset is missing?'}
              </Text>
              <TouchableOpacity onPress={() => setMissingPickerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {!selectedAsset ? (
              assetsQuery.isLoading ? (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <ActivityIndicator color={COLORS.text} />
                </View>
              ) : (
                <FlatList
                  data={assetsQuery.data ?? []}
                  keyExtractor={(item) => item.asset_code}
                  ItemSeparatorComponent={() => <View style={s.sep} />}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setSelectedAsset(item)}
                      activeOpacity={0.6}
                      style={s.modalRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.assetRowTitle}>{item.asset_name || item.asset_code}</Text>
                        <Text style={s.assetRowSub}>
                          {item.asset_code} · last seen{' '}
                          {item.last_seen_at ? fmtDateTime(item.last_seen_at) : 'never'}
                        </Text>
                      </View>
                      {item.last_status === 'Missing' ? (
                        <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
                      ) : null}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                      <Text style={{ color: COLORS.textMuted, fontSize: fontSize.sm, textAlign: 'center' }}>
                        No known assets at your farm yet — scan one as Found first.
                      </Text>
                    </View>
                  }
                />
              )
            ) : (
              <View style={{ padding: spacing.lg }}>
                <Text style={s.confirmAssetName}>
                  {selectedAsset.asset_name || selectedAsset.asset_code}
                </Text>
                <Text style={s.assetRowSub}>{selectedAsset.asset_code}</Text>
                <Text style={s.label}>Remarks (optional)</Text>
                <TextInput
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="e.g. Only the mounting bracket left"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                  style={s.textArea}
                />
                <Button
                  label="CONFIRM MISSING"
                  iconLeft="alert-circle-outline"
                  onPress={submitMissing}
                  loading={reportMissing.isPending}
                  disabled={reportMissing.isPending}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = {
  subtitle: {
    fontSize: fontSize.sm,
    color: COLORS.textMuted,
    marginBottom: spacing.xl,
  },
  actionCard: {
    alignItems: 'center' as const,
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.lg,
  },
  scanBtn: {
    minWidth: 200,
    alignSelf: 'stretch' as const,
  },
  resultCard: {
    alignItems: 'center' as const,
    marginBottom: spacing.lg,
  },
  resultHint: {
    fontSize: fontSize.sm,
    color: COLORS.textMuted,
    marginTop: spacing.sm,
  },
  resultHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.xs,
  },
  resultTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700' as const,
    color: COLORS.text,
    marginLeft: spacing.sm,
  },
  resultCode: {
    fontSize: fontSize.md,
    fontWeight: '600' as const,
    color: COLORS.text,
    marginBottom: 2,
  },
  resultDetail: {
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
  },
  missingBtn: {
    marginTop: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    backgroundColor: COLORS.bg,
    borderRadius: borderRadius.lg,
    maxHeight: 500,
    overflow: 'hidden' as const,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: fontSize.md,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  modalRow: {
    padding: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  assetRowTitle: {
    fontSize: fontSize.md,
    color: COLORS.text,
    fontWeight: '600' as const,
  },
  assetRowSub: {
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  confirmAssetName: {
    fontSize: fontSize.md,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600' as const,
    color: COLORS.textMuted,
    marginBottom: 6,
    marginTop: spacing.lg,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 80,
    textAlignVertical: 'top' as const,
    fontSize: fontSize.md,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
    marginBottom: spacing.lg,
  },
  sep: {
    height: 1,
    backgroundColor: COLORS.bgMuted,
  },
};
