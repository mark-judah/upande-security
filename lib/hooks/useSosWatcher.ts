import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from '@/lib/stores/authStore';
import { startSosListener, stopSosListener } from '@/lib/services/sos';
import {
  refreshEmergencyContact,
  requestCallPermission,
  type EmergencyCallResult,
} from '@/lib/utils/emergencyCall';

function nearbyGuardSummary(alertedGuards?: number): string {
  if (alertedGuards == null) return '';
  if (alertedGuards === 0) return ' No other guards were in range to alert.';
  return ` ${alertedGuards} nearby guard${alertedGuards === 1 ? '' : 's'} alerted.`;
}

function callSummary(call: EmergencyCallResult): string {
  if (call.placed) return 'Supervisor called automatically.';
  if (call.method === 'no_contact') {
    return 'No supervisor contact available on this device yet (never synced) — dialer opened, dial your supervisor manually or use the Incidents tab.';
  }
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
  const hasSession = useAuthStore((s) => s.hasSession);

  // Resolve + cache this guard's actual Security Head number so an SOS never
  // waits on the network — callEmergencyNumber() only reads the cache. This
  // MUST re-fire on every fresh login, not just once at cold start: the root
  // layout that mounts this hook lives for the whole app process lifetime,
  // so a plain mount-once effect would only ever fetch this on the very
  // first launch — before the guard is even logged in, or still pointed at
  // whatever site was configured then. A later logout/login (even to a
  // different site) would never re-trigger it, silently leaving the cache
  // empty (or stale from a previous site) for the rest of the app's life.
  // Keying off hasSession, same pattern as useNearbyGuardAlerts, fixes that.
  useEffect(() => {
    if (!hasSession) return;
    refreshEmergencyContact().catch(() => {});
  }, [hasSession]);

  useEffect(() => {
    // Ask for CALL_PHONE up front so an actual SOS doesn't stall on a
    // permission prompt. No-op on iOS.
    requestCallPermission().catch(() => {});

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
          `${callSummary(result.call)} Incident ${result.incidentName} filed at ${result.location}. Patrol sync could not complete: ${result.error}.${nearbyGuardSummary(result.alertedGuards)}`,
        );
        return;
      }
      Alert.alert(
        'SOS sent',
        `${callSummary(result.call)} Incident ${result.incidentName} filed at ${result.location}. Patrol data flushed.${nearbyGuardSummary(result.alertedGuards)}`,
      );
    });
    return () => stopSosListener();
  }, []);
}
