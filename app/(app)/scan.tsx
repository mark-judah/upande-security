import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useGateStore } from '@/lib/stores/gateStore';

export default function ScanModal() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const handledRef = useRef(false);
  const setPendingScannedTicket = useGateStore((s) => s.setPendingScannedTicket);

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
          We need camera access to scan vehicle work tickets.
        </Text>
        {permission.canAskAgain ? (
          <TouchableOpacity
            onPress={() => requestPermission()}
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
            <Text style={{ color: '#000000', fontWeight: '700' }}>Grant Permission</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
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
            <Text style={{ color: '#000000', fontWeight: '700' }}>Open Settings</Text>
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
    setPendingScannedTicket(data);
    setTimeout(() => {
      if (router.canDismiss()) router.dismiss();
      else router.back();
    }, 50);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 260,
            height: 260,
            borderWidth: 3,
            borderColor: '#FFFFFF',
            borderRadius: 16,
            backgroundColor: 'transparent',
          }}
        />
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: '600',
            marginTop: 20,
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowRadius: 4,
          }}
        >
          Position QR code in the frame
        </Text>
      </View>
    </View>
  );
}
