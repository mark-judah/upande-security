import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import 'react-native-reanimated';
import { useAuthStore } from '@/lib/stores/authStore';
import { useNetworkStore } from '@/src/core/network/store';
import { ToastProvider } from '@/src/core/ui/Toast';
import { DrawerItemsProvider, type DrawerItem } from '@/src/core/ui/drawer-items-context';
import { initPatrolDb } from '@/lib/services/patrolDb';
import { useSosWatcher } from '@/lib/hooks/useSosWatcher';
import { useNearbyGuardAlerts } from '@/lib/hooks/useNearbyGuardAlerts';
import { useIsApprover } from '@/lib/hooks/usePendingApprovals';
import '@/lib/services/patrolTracking';

// Hold the native splash until fonts + auth hydrated.
SplashScreen.preventAutoHideAsync().catch(() => {});

// The biometric-lock screen lives at app/biometric-lock.tsx and is routable
// when this flag is true. The auth store's biometricLocked flag still drives
// when the route activates — see the routing effect below.
const BIOMETRIC_LOCK_ROUTE_AVAILABLE = true;

const queryClient = new QueryClient();

const DRAWER_ITEMS: DrawerItem[] = [
  { label: 'Home',      route: '',           icon: 'home-outline' },
  { label: 'Gate',      route: 'gate',       icon: 'log-in-outline' },
  { label: 'Visits',    route: 'visits',     icon: 'people-outline' },
  { label: 'Approved',  route: 'approved',   icon: 'checkmark-circle-outline' },
  { label: 'Summary',   route: 'summary',    icon: 'stats-chart-outline' },
  { label: 'Incidents', route: 'incidents',  icon: 'warning-outline' },
  { label: 'Patrol',    route: 'patrol',     icon: 'walk-outline' },
  { label: 'Reports',   route: 'reports',    icon: 'bar-chart-outline' },
];

const APPROVALS_DRAWER_ITEM: DrawerItem = {
  label: 'Approvals',
  route: 'approvals',
  icon: 'checkmark-done-outline',
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hasSession = useAuthStore((s) => s.hasSession);
  const biometricLocked = useAuthStore((s) => s.biometricLocked);
  const initNetwork = useNetworkStore((s) => s.init);
  const isApprover = useIsApprover();

  const segments = useSegments();
  const router = useRouter();

  const drawerItems = isApprover ? [...DRAWER_ITEMS, APPROVALS_DRAWER_ITEM] : DRAWER_ITEMS;

  useEffect(() => {
    hydrate();
    initNetwork();
  }, [hydrate, initNetwork]);

  useEffect(() => {
    initPatrolDb().catch(() => {});
  }, []);

  useSosWatcher();
  useNearbyGuardAlerts();

  useEffect(() => {
    if (fontsLoaded && hydrated) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, hydrated]);

  // Safety net: never hold the splash forever. If fonts hang for 5 s, give up.
  useEffect(() => {
    const timeout = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const first = segments[0];
    if (!hasSession && first !== 'login') {
      router.replace('/login');
      return;
    }
    if (
      BIOMETRIC_LOCK_ROUTE_AVAILABLE &&
      hasSession &&
      biometricLocked &&
      (first as string) !== 'biometric-lock'
    ) {
      router.replace('/biometric-lock' as any);
      return;
    }
    if (
      hasSession &&
      !biometricLocked &&
      (first as string) === 'login'
    ) {
      router.replace('/' as any);
      return;
    }
  }, [hydrated, hasSession, biometricLocked, segments, router]);

  if (!fontsLoaded || !hydrated) {
    // Splash is still showing.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <DrawerItemsProvider items={drawerItems}>
            <QueryClientProvider client={queryClient}>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="login" />
                <Stack.Screen name="biometric-lock" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
                <Stack.Screen name="scan-id" options={{ presentation: 'modal' }} />
                <Stack.Screen name="incident-new" />
                <Stack.Screen name="patrol-active" />
                <Stack.Screen name="sos-alert" />
              </Stack>
            </QueryClientProvider>
          </DrawerItemsProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
