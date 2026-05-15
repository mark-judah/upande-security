import '../global.css';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import { View, ActivityIndicator, Text, TextInput } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { useAuthStore } from '@/lib/stores/authStore';
import { theme } from '@/constants/theme';

const queryClient = new QueryClient();

let defaultFontApplied = false;
function applyDefaultFont() {
  if (defaultFontApplied) return;
  defaultFontApplied = true;
  const baseText: any = Text;
  const baseInput: any = TextInput;
  baseText.defaultProps = baseText.defaultProps || {};
  baseInput.defaultProps = baseInput.defaultProps || {};
  baseText.defaultProps.style = [
    { fontFamily: 'Poppins_400Regular' },
    baseText.defaultProps.style,
  ];
  baseInput.defaultProps.style = [
    { fontFamily: 'Poppins_400Regular' },
    baseInput.defaultProps.style,
  ];
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const [hydrated, setHydrated] = useState(false);
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    hydrate().finally(() => setHydrated(true));
  }, [hydrate]);

  useEffect(() => {
    if (fontsLoaded) applyDefaultFont();
  }, [fontsLoaded]);

  if (!hydrated || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.primaryColor} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(app)" />
          </Stack>
          <Toast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
