import * as Location from 'expo-location';
import { pingLocation as pingLocationApi } from '@/lib/api/sosAlert';
import { isPatrolTrackingActive } from '@/lib/services/patrolTracking';

/**
 * Lightweight location keep-alive for the nearby-guard SOS alert system.
 *
 * Any logged-in user (not just a guard actively on patrol) should be
 * findable "nearby" for SOS purposes. Full patrol GPS tracking
 * (patrolTracking.ts / submit_patrol_points) is much heavier — background
 * task, 5s interval, SQLite batching/offline queue — and stays guard-only.
 * This is deliberately dumb: a one-shot low-accuracy fix every few minutes,
 * posted straight through with no retry/queue. If it fails (offline, no
 * permission, transient network blip) it's simply skipped until the next
 * tick.
 */

const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _interval: ReturnType<typeof setInterval> | null = null;
let _ticking = false;

async function tick(): Promise<void> {
  if (_ticking) return;
  _ticking = true;
  try {
    // Never compete with the full patrol GPS pipeline — a guard who is
    // actively patrolling already has much fresher/more accurate location
    // data flowing through submit_patrol_points.
    const patrolling = await isPatrolTrackingActive();
    if (patrolling) return;

    const perms = await Location.getForegroundPermissionsAsync();
    if (perms.status !== 'granted') return;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    const { latitude, longitude } = pos.coords;
    if (latitude == null || longitude == null) return;

    await pingLocationApi({ lat: latitude, lng: longitude });
  } catch (e) {
    if (__DEV__) console.warn('[locationPing] tick failed:', e);
  } finally {
    _ticking = false;
  }
}

/** Starts the periodic ping. Safe to call multiple times (idempotent). */
export function startLocationPing(): void {
  if (_interval) return;
  tick().catch(() => {});
  _interval = setInterval(() => {
    tick().catch(() => {});
  }, PING_INTERVAL_MS);
}

export function stopLocationPing(): void {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
}
