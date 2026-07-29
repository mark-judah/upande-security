import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useGateStore } from '@/lib/stores/gateStore';
import { parseIdCardText } from '@/lib/utils/idCard';
import { playBeep } from '@/lib/services/sounds';

const CARD_ASPECT_RATIO = 1.586; // standard ID card width:height

export default function ScanIdModal() {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const setPendingScannedIdCard = useGateStore((s) => s.setPendingScannedIdCard);

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

  async function onCapture() {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error('No photo captured');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void playBeep();

      const result = await TextRecognition.recognize(photo.uri);
      const parsed = parseIdCardText(result.text);
      setPendingScannedIdCard(parsed);
    } catch {
      // No text recognized / OCR failed — fall back to a blank scan so the
      // guard can just type the details in manually.
      setPendingScannedIdCard({});
    } finally {
      if (router.canDismiss()) router.dismiss();
      else router.back();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
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
            width: '85%',
            aspectRatio: CARD_ASPECT_RATIO,
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
          Position the ID card in the frame
        </Text>
      </View>

      <View
        style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          onPress={onCapture}
          disabled={capturing}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: capturing ? 0.6 : 1,
          }}
        >
          {capturing ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <MaterialIcons name="camera-alt" size={32} color="#000000" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
