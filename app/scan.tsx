import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGateStore } from '@/lib/stores/gateStore';
import { audio } from '@/src/core/audio';
import { COLORS, fontFamily, fontSize, spacing, borderRadius } from '@/src/core/theme';

type Intent =
  | 'ticket'
  | 'employee'
  | 'badge'
  | 'asset'
  | 'dispatch'
  | 'receiving'
  | 'supplierBadge';

export default function ScanModal() {
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent: Intent =
    params.intent === 'employee'
      ? 'employee'
      : params.intent === 'badge'
        ? 'badge'
        : params.intent === 'asset'
          ? 'asset'
          : params.intent === 'dispatch'
            ? 'dispatch'
            : params.intent === 'receiving'
              ? 'receiving'
              : params.intent === 'supplierBadge'
                ? 'supplierBadge'
                : 'ticket';
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const handledRef = useRef(false);
  const setPendingScannedTicket = useGateStore((s) => s.setPendingScannedTicket);
  const setPendingScannedEmployee = useGateStore((s) => s.setPendingScannedEmployee);
  const setPendingScannedBadge = useGateStore((s) => s.setPendingScannedBadge);
  const setPendingScannedAsset = useGateStore((s) => s.setPendingScannedAsset);
  const setPendingScannedDispatch = useGateStore((s) => s.setPendingScannedDispatch);
  const setPendingScannedReceiving = useGateStore((s) => s.setPendingScannedReceiving);
  const setPendingScannedSupplierBadge = useGateStore((s) => s.setPendingScannedSupplierBadge);

  if (!permission) {
    return <View style={s.cameraBg} />;
  }

  if (!permission.granted) {
    return (
      <View style={s.permissionScreen}>
        <Ionicons name="camera-outline" size={56} color={COLORS.textMuted} />
        <Text style={s.permissionTitle}>Camera permission required</Text>
        <Text style={s.permissionSubtitle}>
          We need camera access to scan QR codes.
        </Text>
        {permission.canAskAgain ? (
          <TouchableOpacity
            onPress={() => requestPermission()}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={s.permissionBtn}
          >
            <Text style={s.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={s.permissionBtn}
          >
            <Text style={s.permissionBtnText}>Open Settings</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (handledRef.current) return;
    handledRef.current = true;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    audio.beep();
    if (intent === 'employee') {
      setPendingScannedEmployee(data);
    } else if (intent === 'badge') {
      setPendingScannedBadge(data);
    } else if (intent === 'asset') {
      setPendingScannedAsset(data);
    } else if (intent === 'dispatch') {
      setPendingScannedDispatch(data);
    } else if (intent === 'receiving') {
      setPendingScannedReceiving(data);
    } else if (intent === 'supplierBadge') {
      setPendingScannedSupplierBadge(data);
    } else {
      setPendingScannedTicket(data);
    }
    setTimeout(() => {
      if (router.canDismiss()) router.dismiss();
      else router.back();
    }, 50);
  };

  return (
    <View style={s.cameraBg}>
      <CameraView
        style={s.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
      />
      <View pointerEvents="none" style={s.overlay}>
        <View style={s.frame} />
        <Text style={s.frameHint}>
          {intent === 'employee'
            ? 'Scan employee badge'
            : intent === 'badge'
              ? 'Scan visitor badge QR'
              : intent === 'asset'
                ? 'Scan the asset QR sticker'
                : intent === 'dispatch'
                  ? 'Scan the dispatch document QR / barcode'
                  : intent === 'receiving'
                    ? 'Scan the receiving/PO document QR / barcode'
                    : intent === 'supplierBadge'
                      ? 'Scan the supplier’s badge'
                      : 'Position QR code in the frame'}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cameraBg: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1 },
  permissionScreen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  permissionTitle: {
    color: COLORS.textOnPrimary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.semiBold,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: COLORS.textMuted,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: spacing.sm - 2,
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xl - 4,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBtnText: {
    color: COLORS.text,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: COLORS.textOnPrimary,
    borderRadius: borderRadius.lg,
    backgroundColor: 'transparent',
  },
  frameHint: {
    color: COLORS.textOnPrimary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semiBold,
    marginTop: spacing.xl - 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
});
