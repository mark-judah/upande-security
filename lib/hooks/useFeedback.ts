import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { playSubmit, playError } from '@/lib/services/sounds';

export function useFeedback() {
  return {
    success: (message: string) => {
      void playSubmit();
      Toast.show({ type: 'success', text1: message });
    },
    error: (message: string) => {
      void playError();
      Toast.show({ type: 'error', text1: message });
    },
    warning: (message: string) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Toast.show({ type: 'info', text1: message });
    },
  };
}
