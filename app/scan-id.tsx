import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { scanMRZ } from 'rn-mrz-scanner';
import { useGateStore } from '@/lib/stores/gateStore';
import { useSessionInfo } from '@/lib/hooks/useSessionInfo';
import { MrzPhotoScanner } from '@/components/gate/MrzPhotoScanner';
import { mrzRejectionReason, parseMrzString } from '@/lib/utils/mrz';
import { audio } from '@/src/core/audio';

/**
 * ID scan by MRZ only - the three lines of letters and chevrons on the back
 * of the newer ID cards. A read is accepted only when every check digit
 * passes (lib/utils/mrz.ts), so a wrong ID number can't be filled in. Cards
 * without an MRZ (the older Kenyan ID) are entered by hand - general OCR
 * guessed wrong too often to keep.
 *
 * The actual scanning is native and opaque to us: rn-mrz-scanner presents
 * its own full-screen camera view (Google ML Kit Text Recognition on
 * Android, Apple Vision on iOS) with a built-in card-shaped overlay, finds
 * the MRZ wherever it sits in frame - no fixed crop fraction to guess, no
 * camera-binding plumbing of our own - and only resolves once its own
 * multi-frame stabiliser is confident. We call scanMRZ(), then run the same
 * check-digit validation we always did on whatever text comes back.
 *
 * Replaces react-native-mrz-reader (bundled Tesseract + a hand-patched
 * CameraX pipeline): three rounds of native patches to its crop/PSM/camera-
 * binding code still failed to read a card on a real device, while a
 * detection-based engine read the same card correctly first try.
 */
export default function ScanIdModal() {
  const [permission, requestPermission] = useCameraPermissions();
  // Beta: System Managers get our own MRZ reader first (MrzPhotoScanner),
  // with ML Kit one tap away; everyone else keeps ML Kit only.
  const session = useSessionInfo();
  const [useOldScanner, setUseOldScanner] = useState(false);
  const beta = !useOldScanner && (session.data?.roles ?? []).includes('System Manager');
  const sessionKnown = session.isFetched || session.isError;
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
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

  const finishManually = useCallback(() => {
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

  const finishWithCard = useCallback(
    (name?: string, idNumber?: string) => {
      if (done.current) return;
      done.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      audio.beep();
      const card = { name, idNumber };
      if (scanIdContextRef.current === 'search') {
        setPendingScannedIdForSearch(card);
      } else {
        setPendingScannedIdCard(card);
      }
      close();
    },
    [setPendingScannedIdCard, setPendingScannedIdForSearch, close],
  );

  const runScan = useCallback(async () => {
    setError(null);
    setScanning(true);
    try {
      const raw = await scanMRZ({ instructionText: 'Show the back of the ID - the 3 lines of letters and <<<' });
      if (done.current) return;
      const parsed = parseMrzString(raw);
      if (!parsed) {
        // The native side already filters by MRZ shape and stabilises over
        // several frames before ever returning, so landing here (passed
        // its check, failed ours) should be rare - but never trust a scan
        // result over the check digits. Let the guard retry rather than
        // silently falling back, since a second attempt is cheap here.
        setScanning(false);
        setError(mrzRejectionReason(raw) ?? 'That read did not check out');
        return;
      }
      finishWithCard(parsed.name, parsed.idNumber);
    } catch (e) {
      if (done.current) return;
      setScanning(false);
      const code = (e as { code?: string } | null)?.code;
      if (code === 'ERR_CANCELLED') {
        // The native screen's own back/dismiss gesture - same outcome as
        // choosing "enter manually" below.
        finishManually();
        return;
      }
      setError('Could not open the scanner');
    }
  }, [finishWithCard, finishManually]);

  // Fire the native scanner the moment permission is in hand - there is no
  // live preview of our own to show first, the scanner's own screen is the
  // whole UI while it runs.
  useEffect(() => {
    if (permission?.granted && sessionKnown && !beta) {
      runScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted, sessionKnown, beta]);

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
        <TouchableOpacity onPress={finishManually} style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: '#FFFFFF', textDecorationLine: 'underline' }}>Enter details manually</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (beta && sessionKnown) {
    return (
      <MrzPhotoScanner
        onCard={finishWithCard}
        onUseMlKit={() => setUseOldScanner(true)}
        onManual={finishManually}
      />
    );
  }

  // Permission granted: either the native scanner is up full-screen right
  // now (nothing of ours to render underneath it), or it has returned with
  // an error/invalid read and we're showing our own retry screen.
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
      {scanning ? (
        <ActivityIndicator size="large" color="#FFFFFF" />
      ) : (
        <>
          <MaterialIcons
            name={error ? 'error-outline' : 'badge'}
            size={48}
            color={error ? '#FBBF24' : '#666666'}
          />
          {error ? (
            <Text
              style={{
                color: '#FBBF24',
                fontSize: 14,
                marginTop: 12,
                textAlign: 'center',
                paddingHorizontal: 16,
              }}
            >
              {error} - keep the card still and flat, then try again
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={runScan}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderRadius: 8,
              marginTop: 20,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#000000', fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity onPress={finishManually} style={{ marginTop: 16, padding: 12 }}>
        <Text style={{ color: '#FFFFFF', textDecorationLine: 'underline' }}>Enter details manually</Text>
      </TouchableOpacity>
    </View>
  );
}
