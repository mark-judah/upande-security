import { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import MrzReader, { CameraSelector, DocType, ResizeMode } from 'react-native-mrz-reader';
import { useGateStore } from '@/lib/stores/gateStore';
import { mrzRejectionReason, parseMrzString } from '@/lib/utils/mrz';
import { audio } from '@/src/core/audio';

/**
 * ID scan by MRZ only - the three lines of letters and chevrons on the back
 * of the newer ID cards. A dedicated MRZ reader (Tesseract trained on the
 * MRZ font) watches the live camera; a read is accepted only when every
 * check digit passes, so a wrong ID number can't be filled in. Cards without
 * an MRZ (the older Kenyan ID) are entered by hand - general OCR guessed
 * wrong too often to keep.
 *
 * No framing box - the guard doesn't have to line the card up inside a
 * drawn outline. The native reader instead crops to the bottom half of
 * whatever frame it gets (see MrzReaderAnalyzer/MrzUtil in the patched
 * react-native-mrz-reader) - a TD1 card's MRZ is always printed along its
 * bottom edge, so that's tolerant of where in view the card sits without
 * needing the screen to draw a box around it.
 */
export default function ScanIdModal() {
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);
  // Shown when the reader saw an MRZ but it did not validate - so a guard
  // knows the camera is reading and can steady the card.
  const [rejected, setRejected] = useState<string | null>(null);
  const setPendingScannedIdCard = useGateStore((s) => s.setPendingScannedIdCard);
  const setPendingScannedIdForSearch = useGateStore((s) => s.setPendingScannedIdForSearch);
  // Which caller sent us here - the walk-in form (fills Name/ID fields
  // directly) or the search bar (scan as a shortcut for typing an ID and
  // searching). Read once on mount: the caller sets this immediately
  // before navigating, so it can't change out from under an open scan.
  const scanIdContextRef = useRef(useGateStore.getState().scanIdContext);

  const close = useCallback(() => {
    if (router.canDismiss()) router.dismiss();
    else router.back();
  }, []);

  const onMrzRead = useCallback(
    (raw: string) => {
      if (done.current) return;
      const parsed = parseMrzString(raw);
      if (!parsed) {
        setRejected(mrzRejectionReason(raw) ?? 'MRZ read but not valid');
        return; // keep scanning
      }
      done.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      audio.beep();
      const card = { name: parsed.name, idNumber: parsed.idNumber };
      if (scanIdContextRef.current === 'search') {
        setPendingScannedIdForSearch(card);
      } else {
        setPendingScannedIdCard(card);
      }
      close();
    },
    [setPendingScannedIdCard, setPendingScannedIdForSearch, close],
  );

  const enterManually = useCallback(() => {
    if (done.current) return;
    done.current = true;
    if (scanIdContextRef.current === 'search') {
      // Nothing to prefill - the search bar behind this modal already IS
      // the manual-entry path, just close and let the guard type there.
      setPendingScannedIdForSearch(null);
    } else {
      setPendingScannedIdCard({});
    }
    close();
  }, [setPendingScannedIdCard, setPendingScannedIdForSearch, close]);

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000000',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <MaterialIcons name="no-photography" size={56} color="#666666" />
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '600',
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          Camera permission required
        </Text>
        <Text style={{ color: '#AAAAAA', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
          We need camera access to scan the ID card.
        </Text>
        <TouchableOpacity
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 18,
            paddingVertical: 14,
            borderRadius: 8,
            marginTop: 20,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#000000', fontWeight: '700' }}>
            {permission.canAskAgain ? 'Grant Permission' : 'Open Settings'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={enterManually} style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: '#FFFFFF', textDecorationLine: 'underline' }}>Enter details manually</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <MrzReader
        style={{ flex: 1 }}
        docType={DocType.ID}
        cameraSelector={CameraSelector.Back}
        resizeMode={ResizeMode.COVER}
        onMRZRead={onMrzRead}
      />

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          paddingTop: 48,
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: '600',
            textAlign: 'center',
            paddingHorizontal: 24,
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowRadius: 4,
          }}
        >
          Show the back of the ID - the 3 lines of letters and {'<<<'}
        </Text>
        <Text
          style={{
            color: '#D1D5DB',
            fontSize: 13,
            marginTop: 6,
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowRadius: 4,
          }}
        >
          Fill most of the screen with the card - reads automatically, anywhere in view
        </Text>
        {rejected ? (
          <Text
            style={{
              color: '#FBBF24',
              fontSize: 13,
              marginTop: 8,
              paddingHorizontal: 24,
              textAlign: 'center',
              textShadowColor: 'rgba(0,0,0,0.8)',
              textShadowRadius: 4,
            }}
          >
            {rejected} - keep the card still and flat
          </Text>
        ) : null}
      </View>

      <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={enterManually}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            backgroundColor: 'rgba(255,255,255,0.92)',
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 24,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <MaterialIcons name="keyboard" size={20} color="#000000" />
          <Text style={{ color: '#000000', fontWeight: '700', marginLeft: 8 }}>
            No MRZ on this card? Enter manually
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
