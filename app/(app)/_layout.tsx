import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="gate" />
      <Stack.Screen
        name="scan"
        options={{ presentation: 'modal', headerShown: true, title: 'Scan Work Ticket' }}
      />
    </Stack>
  );
}
