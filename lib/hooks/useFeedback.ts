import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';

const SUBMIT_SOUND = require('../../assets/sounds/submit.wav');
const ERROR_SOUND = require('../../assets/sounds/error.wav');

export function useFeedback() {
  const submitPlayer = useAudioPlayer(SUBMIT_SOUND);
  const errorPlayer = useAudioPlayer(ERROR_SOUND);

  return {
    success: (message: string) => {
      try {
        submitPlayer.seekTo(0);
        submitPlayer.play();
      } catch {
        // ignore audio errors; toast still shows
      }
      Toast.show({ type: 'success', text1: message });
    },
    error: (message: string) => {
      try {
        errorPlayer.seekTo(0);
        errorPlayer.play();
      } catch {
        // ignore
      }
      Toast.show({ type: 'error', text1: message });
    },
    warning: (message: string) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Toast.show({ type: 'info', text1: message });
    },
  };
}
