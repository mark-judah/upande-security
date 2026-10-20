import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSessionInfo } from '@/lib/hooks/useSessionInfo';
import { ensureDutyTracking, stopDutyTracking } from '@/lib/services/dutyTracking';

/**
 * Mount once inside QueryClientProvider (it reads session info). Keeps
 * on-duty location tracking running for as long as the guard is logged in,
 * when the server supports and allows it, and stops it on logout. See
 * dutyTracking.ts.
 */
export function useDutyTracking(): void {
  const hasSession = useAuthStore((s) => s.hasSession);
  const { data } = useSessionInfo();
  const config = data?.on_duty_tracking;
  const user = data?.user ?? '';
  const enabled = !!config?.enabled;
  const interval = config?.interval_minutes ?? 5;

  useEffect(() => {
    if (!hasSession) {
      stopDutyTracking().catch(() => {});
      return;
    }
    if (!data) return; // session info still loading
    if (!enabled || !user) {
      stopDutyTracking().catch(() => {});
      return;
    }
    const ensure = () => ensureDutyTracking(user, interval).catch(() => {});
    ensure();
    // The OS can stop a background service; check again whenever the app
    // comes to the front.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ensure();
    });
    return () => sub.remove();
  }, [hasSession, !!data, enabled, user, interval]);
}
