import * as Haptics from 'expo-haptics';
import { useToast } from '@/src/core/ui/Toast';

/**
 * Thin adapter that lets legacy callers keep the
 * `{ success, error, warning }` API while rendering through the canonical
 * useToast. Wave 4b/4c migrates the screens to call useToast directly.
 */
export function useFeedback() {
  const { showSuccess, showError, showInfo } = useToast();
  return {
    success: (message: string) => showSuccess(message),
    error: (message: string) => showError(message),
    warning: (message: string) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      showInfo(message);
    },
  };
}
