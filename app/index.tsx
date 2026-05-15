import { Redirect } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';

export default function Index() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthed) return <Redirect href="/login" />;
  return <Redirect href="/(app)/(tabs)/gate" />;
}
