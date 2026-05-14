import { VolumeManager } from 'react-native-volume-manager';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { createIncidentReport } from '@/lib/api/incidents';
import { getActivePatrol } from '@/lib/services/patrolDb';
import { flushAllPatrolPending } from '@/lib/services/patrolGpsSync';
import { toFrappeDateTime } from '@/lib/utils/date';

/**
 * SOS detection via rapid / held volume-button presses.
 *
 * We listen to VolumeManager's volume-change events. Holding a volume button
 * fires repeat events at ~100 ms on Android; pressing it many times quickly
 * does the same. A human is extremely unlikely to produce >= 5 volume events
 * within 5 seconds during normal use, so that threshold is the trigger.
 *
 * Limitation: this only fires while the app is in the foreground (the OS
 * delivers volume events to the focused app). Even with an Android foreground
 * service active (from patrol tracking), a locked screen won't route key
 * events here — the guard needs the phone unlocked.
 */

const TRIGGER_THRESHOLD = 5;
const WINDOW_MS = 5_000;
const COOLDOWN_MS = 30_000;

type SosResult =
  | { status: 'sent'; incidentName: string; location: string }
  | { status: 'partial'; incidentName: string; location: string; error: string }
  | { status: 'error'; error: string };

let _subscription: { remove: () => void } | null = null;
let _events: number[] = [];
let _lastTrigger = 0;
let _firing = false;
let _onFired: ((result: SosResult) => void) | null = null;

export function startSosListener(onFired: (result: SosResult) => void): void {
  stopSosListener();
  _onFired = onFired;
  try {
    _subscription = VolumeManager.addVolumeListener(() => {
      const now = Date.now();
      _events.push(now);
      _events = _events.filter((t) => now - t < WINDOW_MS);

      if (
        !_firing &&
        _events.length >= TRIGGER_THRESHOLD &&
        now - _lastTrigger > COOLDOWN_MS
      ) {
        _lastTrigger = now;
        _events = [];
        _firing = true;
        triggerSos()
          .then((r) => _onFired?.(r))
          .catch((e) => {
            if (__DEV__) console.warn('[sos] trigger error:', e);
          })
          .finally(() => {
            _firing = false;
          });
      }
    });
  } catch (e) {
    if (__DEV__) console.warn('[sos] listener failed to attach:', e);
  }
}

export function stopSosListener(): void {
  if (_subscription) {
    try {
      _subscription.remove();
    } catch {
      // ignore
    }
    _subscription = null;
  }
  _events = [];
  _onFired = null;
}

async function triggerSos(): Promise<SosResult> {
  // Haptic first so the guard knows something happened.
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

  // Get the best location we can in a hurry — never block longer than 4s.
  let locationText = '';
  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    if (pos && 'coords' in pos) {
      locationText = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
    }
  } catch {
    // fall through to last-known
  }
  if (!locationText) {
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        locationText = `${last.coords.latitude.toFixed(6)}, ${last.coords.longitude.toFixed(6)} (last known)`;
      }
    } catch {
      // ignore
    }
  }
  if (!locationText) locationText = 'Location unavailable';

  // Create the SOS incident. Severity: Critical. Nature: must exist as an
  // Incident Category on the server (user created "SOS").
  let incidentName = '';
  try {
    const created = await createIncidentReport({
      incident_datetime: toFrappeDateTime(),
      location: locationText,
      nature_of_incident: 'SOS',
      severity: 'Critical',
      description: 'SOS',
    });
    incidentName = created.name;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'incident create failed';
    return { status: 'error', error: msg };
  }

  // Also flush any queued patrol GPS points.
  let flushError: string | null = null;
  try {
    const active = await getActivePatrol();
    if (active && !active.stoppedAt) {
      await flushAllPatrolPending(active.patrolTag);
    }
  } catch (e) {
    flushError = e instanceof Error ? e.message : 'patrol flush failed';
  }

  if (flushError) {
    return { status: 'partial', incidentName, location: locationText, error: flushError };
  }
  return { status: 'sent', incidentName, location: locationText };
}
