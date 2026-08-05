import { useEffect } from 'react';
import { Alert } from 'react-native';
import { startSosListener, stopSosListener } from '@/lib/services/sos';
import {
  refreshEmergencyContact,
  requestCallPermission,
  type EmergencyCallResult,
} from '@/lib/utils/emergencyCall';

function callSummary(call: EmergencyCallResult): string {
  if (call.placed) return 'Supervisor called automatically.';
  if (call.reason === 'ios') return 'Dialer opened — tap Call to reach your supervisor.';
  if (call.reason === 'permission_denied') {
    return 'Call permission not granted — dialer opened, tap Call to reach your supervisor.';
  }
  return 'Could not start the call automatically — dialer opened, tap Call to reach your supervisor.';
}

/**
 * Mount this once inside the authenticated area. It attaches a volume-button
 * listener and surfaces an alert to the guard when an SOS is fired + uploaded.
 */
export function useSosWatcher(): void {
  useEffect(() => {
    // Ask for CALL_PHONE up front so an actual SOS doesn't stall on a
    // permission prompt. No-op on iOS.
    requestCallPermission().catch(() => {});

    // Resolve + cache this guard's actual Security Head number so an SOS
    // never waits on the network — callEmergencyNumber() only reads the
    // cache. Refreshed on every mount to pick up staffing/config changes.
    refreshEmergencyContact().catch(() => {});

    startSosListener((result) => {
      if (result.status === 'error') {
        Alert.alert(
          'SOS failed',
          `${callSummary(result.call)} Could not file the SOS incident: ${result.error}. Try again or open the Incidents tab to file manually.`,
        );
        return;
      }
      if (result.status === 'partial') {
        Alert.alert(
          'SOS sent',
          `${callSummary(result.call)} Incident ${result.incidentName} filed at ${result.location}. Patrol sync could not complete: ${result.error}.`,
        );
        return;
      }
      Alert.alert(
        'SOS sent',
        `${callSummary(result.call)} Incident ${result.incidentName} filed at ${result.location}. Patrol data flushed.`,
      );
    });
    return () => stopSosListener();
  }, []);
}
