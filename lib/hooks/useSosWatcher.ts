import { useEffect } from 'react';
import { Alert } from 'react-native';
import { startSosListener, stopSosListener } from '@/lib/services/sos';

/**
 * Mount this once inside the authenticated area. It attaches a volume-button
 * listener and surfaces an alert to the guard when an SOS is fired + uploaded.
 */
export function useSosWatcher(): void {
  useEffect(() => {
    startSosListener((result) => {
      if (result.status === 'error') {
        Alert.alert(
          'SOS failed',
          `Could not file the SOS incident: ${result.error}. Try again or open the Incidents tab to file manually.`,
        );
        return;
      }
      if (result.status === 'partial') {
        Alert.alert(
          'SOS sent',
          `Incident ${result.incidentName} filed at ${result.location}. Patrol sync could not complete: ${result.error}.`,
        );
        return;
      }
      Alert.alert(
        'SOS sent',
        `Incident ${result.incidentName} filed at ${result.location}. Patrol data flushed.`,
      );
    });
    return () => stopSosListener();
  }, []);
}
