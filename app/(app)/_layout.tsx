import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { initPatrolDb } from '@/lib/services/patrolDb';
import { useSosWatcher } from '@/lib/hooks/useSosWatcher';
import '@/lib/services/patrolTracking';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    initPatrolDb().catch(() => {
      // swallow — SQLite errors on init shouldn't crash the app shell
    });
  }, []);

  useSosWatcher();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="scan"
        options={{ presentation: 'modal', headerShown: true, title: 'Scan QR Code' }}
      />
    </Stack>
  );
}
