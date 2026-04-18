import { useAuthStore } from '@/lib/stores/authStore';

export function useAuth() {
  return useAuthStore();
}
