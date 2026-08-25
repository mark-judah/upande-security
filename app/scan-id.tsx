import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator, StyleSheet } from 'react-native';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Camera as OcrCamera, type Text as OcrResult } from 'react-native-vision-camera-ocr-plus';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useGateStore } from '@/lib/stores/gateStore';
import { parseMrzFromBlocks } from '@/lib/utils/mrz';
import { extractIdCardTemplate } from '@/lib/utils/idCardTemplate';
import { adaptOcrPlusResult } from '@/lib/utils/ocrAdapter';
import { audio } from '@/src/core/audio';

/**
 * Real-time MRZ / ID-card scanner. Runs OCR continuously against live
 * camera frames via a VisionCamera frame processor (react-native-vision-
 * camera-ocr-plus's own `<Camera mode="recognize">`, which wraps
 * VisionCamera's `useFrameOutput` + a worklet-safe ML Kit text recognizer
 * and marshals each result back to the JS thread for us) — no shutter
 * button, no manual capture, no disk round-trips. `frameSkipThreshold`
 * below throttles OCR to every Nth frame rather than literally every frame
 * the sensor produces, which is what the old 800ms `setInterval` cadence
 * was standing in for.
 *
 * Detector race per result, unchanged from the previous photo-capture
 * implementation: MRZ first (checksum-validated, so a pass is *known*
 * correct), falling back to the label-anchored template extractor for the
 * classic (no-MRZ) Kenyan ID. First confident hit wins.
 */
export default function ScanIdModal() {
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const setPendingScannedIdCard = useGateStore((s) => s.setPendingScannedIdCard);

  const [succeeded, setSucceeded] = useState(false);

  // The OCR callback can fire faster than React re-renders (VisionCamera's
  // frame pipeline queues each result onto the JS thread independently), so
  // `succeeded` state alone isn't a safe enough guard against acting twice
  // on a successful capture (double dismiss, double store write). This ref
  // is checked synchronously, first thing, in every callback invocation.
  // It's also set on manual close and on unmount, so nothing acts after the
  // guard has backed out or the screen is gone either.
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    return () => {
      stoppedRef.current = true;
    };
  }, []);

  const handleOcrResult = useCallback(
    (data: string | OcrResult) => {
      if (stoppedRef.current) return;

      // mode="recognize" always yields the OCR `Text` result shape (the
      // `string` half of the callback's type only applies to mode="translate").
      const result = data as OcrResult;
      if (!result?.blocks?.length) return;

      const blocks = adaptOcrPlusResult(result);

      const mrz = parseMrzFromBlocks(blocks);
      const template = mrz ? null : extractIdCardTemplate(blocks);
      const parsed: { idNumber?: string; name?: string } | null =
        mrz ?? (template?.confident ? template : null);

      if (!parsed) return; // nothing confident this frame — keep scanning

      stoppedRef.current = true;
      setSucceeded(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      audio.beep();
      setPendingScannedIdCard({ idNumber: parsed.idNumber, name: parsed.name });
      if (router.canDismiss()) router.dismiss();
      else router.back();
    },
    [setPendingScannedIdCard],
  );

  function onClose() {
    stoppedRef.current = true;
    if (router.canDismiss()) router.dismiss();
    else router.back();
  }

  if (!hasPermission) {
    return (
      <View style={s.permissionScreen}>
        <MaterialIcons name="no-photography" size={56} color="#666666" />
        <Text style={s.permissionTitle}>Camera permission required</Text>
        <Text style={s.permissionSubtitle}>We need camera access to scan the ID card.</Text>
        {canRequestPermission ? (
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

  if (!device) {
    // No back camera device enumerated yet (or none present) — camera
    // hardware not ready. Same dark background as the scanning state so
    // there's no visible flash/flicker once the device resolves.
    return (
      <View style={s.cameraBg}>
        <View style={s.statusWrap}>
          <View style={s.statusPill}>
            <ActivityIndicator size="small" color="#FFFFFF" style={s.statusSpinner} />
            <Text style={s.statusText}>Starting camera...</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
          style={s.closeBtn}
        >
          <MaterialIcons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.cameraBg}>
      <OcrCamera
        // react-native-vision-camera-ocr-plus@2.0.6's own `CameraTypes` type
        // (src/types.d.ts) is built from VisionCamera's `useCamera` hook's
        // `CameraProps`, which has no `style` field — only the *component*
        // variant (`CameraViewProps`, what the underlying native `<Camera>`
        // this wraps actually renders) accepts `style`, and ocr-plus's
        // `<Camera>` does forward it (`{...p}` spread in its own source).
        // This is an upstream type-definition gap, not a runtime issue.
        // @ts-expect-error — see comment above; `style` is forwarded to the real native <Camera>.
        style={s.camera}
        device={device}
        isActive={!succeeded}
        mode="recognize"
        options={{
          language: 'latin',
          // Every 5th frame is a middle ground: fast enough that a guard
          // holding the card steady gets a near-instant read, without
          // saturating the device running full OCR on literally every
          // frame the sensor produces.
          frameSkipThreshold: 5,
        }}
        callback={handleOcrResult}
      />

      <TouchableOpacity
        onPress={onClose}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Close scanner"
        style={s.closeBtn}
      >
        <MaterialIcons name="close" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <View pointerEvents="none" style={s.statusWrap}>
        <View style={s.statusPill}>
          {!succeeded && <ActivityIndicator size="small" color="#FFFFFF" style={s.statusSpinner} />}
          <Text style={s.statusText}>{succeeded ? 'Captured' : 'Scanning for ID...'}</Text>
        </View>
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
    padding: 32,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: '#AAAAAA',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 20,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBtnText: { color: '#000000', fontWeight: '700' },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusWrap: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusSpinner: { marginRight: 8 },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
