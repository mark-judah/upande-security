import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  addPatrolGpsPoints,
  getActivePatrol,
  getLatestPatrolGpsPoint,
  type PatrolGpsPoint,
} from './patrolDb';
import { haversineMeters, formatCapturedAt } from '@/lib/utils/haversine';

export const PATROL_LOCATION_TASK = 'patrol-location-task';

const PATROL_TIME_INTERVAL_MS = 5_000;
const PATROL_DB_BATCH_SIZE = 20;
const TRUST_LIMIT_MULTIPLIER = 30;
const MIN_DEDUP_INTERVAL_MS = 3_000;
const MIN_TRUST_RADIUS_M = 150;

const WATCHDOG_INITIAL_DELAY_MS = 120_000;
const WATCHDOG_INTERVAL_MS = 120_000;

let _activePatrol: { patrolTag: string; guard: string } | null = null;

let _foregroundInterval: ReturnType<typeof setInterval> | null = null;
let _foregroundData: { patrolTag: string; guard: string } | null = null;

let _watchdogInterval: ReturnType<typeof setInterval> | null = null;
let _watchdogTimeout: ReturnType<typeof setTimeout> | null = null;
let _watchdogData: { patrolTag: string; guard: string } | null = null;
let _watchdogBusy = false;

export async function storePatrolLocation(
  location: Location.LocationObject,
  patrolTag: string,
  _guard: string,
): Promise<void> {
  const { latitude, longitude, accuracy } = location.coords;
  if (latitude == null || longitude == null) return;

  const previous = await getLatestPatrolGpsPoint(patrolTag);
  if (previous) {
    const prevTs = Date.parse(previous.capturedAt.replace(' ', 'T'));
    if (
      Number.isFinite(prevTs) &&
      location.timestamp - prevTs < MIN_DEDUP_INTERVAL_MS
    ) {
      return;
    }
    const distance = haversineMeters(
      previous.latitude,
      previous.longitude,
      latitude,
      longitude,
    );
    const trusted =
      accuracy && accuracy > 0
        ? Math.max(accuracy * TRUST_LIMIT_MULTIPLIER, MIN_TRUST_RADIUS_M)
        : MIN_TRUST_RADIUS_M;
    if (distance > trusted) return;
  }

  const point: Omit<PatrolGpsPoint, 'id' | 'synced'> = {
    patrolTag,
    clientId: null,
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    capturedAt: formatCapturedAt(location.timestamp),
  };
  await addPatrolGpsPoints([point]);
}

// ---------- Background task ----------
TaskManager.defineTask(PATROL_LOCATION_TASK, async (payload) => {
  try {
    if (payload.error) return;
    const locations =
      (payload.data as { locations?: Location.LocationObject[] } | undefined)
        ?.locations ?? [];
    if (!locations.length) return;

    let tag = _activePatrol?.patrolTag ?? null;
    let guard = _activePatrol?.guard ?? null;
    if (!tag) {
      // getActivePatrol() will implicitly open + init the SQLite DB
      // (first call in a cold background wake-up).
      const stored = await getActivePatrol();
      if (!stored) return;
      tag = stored.patrolTag;
      guard = stored.guard;
      _activePatrol = { patrolTag: tag, guard };
    }

    const toInsert: Omit<PatrolGpsPoint, 'id' | 'synced'>[] = [];
    const last = await getLatestPatrolGpsPoint(tag);
    let prevLat = last?.latitude ?? null;
    let prevLng = last?.longitude ?? null;
    let prevTs = last ? Date.parse(last.capturedAt.replace(' ', 'T')) : null;

    for (const loc of locations) {
      const { latitude, longitude, accuracy } = loc.coords;
      if (latitude == null || longitude == null) continue;

      if (prevTs && loc.timestamp - prevTs < MIN_DEDUP_INTERVAL_MS) continue;

      if (prevLat != null && prevLng != null) {
        const distance = haversineMeters(prevLat, prevLng, latitude, longitude);
        const trusted =
          accuracy && accuracy > 0
            ? Math.max(accuracy * TRUST_LIMIT_MULTIPLIER, MIN_TRUST_RADIUS_M)
            : MIN_TRUST_RADIUS_M;
        if (distance > trusted) continue;
      }

      toInsert.push({
        patrolTag: tag,
        clientId: null,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        capturedAt: formatCapturedAt(loc.timestamp),
      });

      prevLat = latitude;
      prevLng = longitude;
      prevTs = loc.timestamp;
    }

    if (!toInsert.length) return;

    for (let i = 0; i < toInsert.length; i += PATROL_DB_BATCH_SIZE) {
      await addPatrolGpsPoints(toInsert.slice(i, i + PATROL_DB_BATCH_SIZE));
    }
  } catch (e) {
    if (__DEV__) console.warn('[patrol-location-task]', e);
    // Swallow — a transient native failure (e.g. SQLite handle reclaimed)
    // shouldn't crash the task. The next OS-scheduled fire will retry and
    // getDb() will reopen a fresh handle.
  }
});

// ---------- Permissions ----------
export async function requestPatrolLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const fg = await Location.requestForegroundPermissionsAsync();
  const bg =
    fg.status === 'granted'
      ? await Location.requestBackgroundPermissionsAsync()
      : { status: 'denied' as const };
  return {
    foreground: fg.status === 'granted',
    background: bg.status === 'granted',
  };
}

export async function getPatrolLocationPermissionsStatus(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return {
    foreground: fg.status === 'granted',
    background: bg.status === 'granted',
  };
}

// ---------- Background task lifecycle ----------
export async function startPatrolLocationUpdates(
  patrolTag: string,
  guard: string,
): Promise<boolean> {
  _activePatrol = { patrolTag, guard };
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(PATROL_LOCATION_TASK);
    if (already) return true;

    await Location.startLocationUpdatesAsync(PATROL_LOCATION_TASK, {
      accuracy: Location.Accuracy.Highest,
      distanceInterval: 0,
      timeInterval: PATROL_TIME_INTERVAL_MS,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.OtherNavigation,
      showsBackgroundLocationIndicator: true,
      deferredUpdatesInterval: PATROL_TIME_INTERVAL_MS,
      deferredUpdatesDistance: 0,
      foregroundService: {
        notificationTitle: 'Patrol Active',
        notificationBody: `Tracking patrol: ${patrolTag}`,
        notificationColor: '#000000',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[startPatrolLocationUpdates]', e);
    return false;
  }
}

export async function stopPatrolLocationUpdates(): Promise<void> {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(PATROL_LOCATION_TASK);
    if (running) {
      await Location.stopLocationUpdatesAsync(PATROL_LOCATION_TASK);
    }
  } catch (e) {
    if (__DEV__) console.warn('[stopPatrolLocationUpdates]', e);
  }
  _activePatrol = null;
}

export async function isPatrolTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(PATROL_LOCATION_TASK);
  } catch {
    return false;
  }
}

// ---------- Foreground poller ----------
export function startPatrolForegroundPolling(patrolTag: string, guard: string): void {
  stopPatrolForegroundPolling();
  _foregroundData = { patrolTag, guard };
  _foregroundInterval = setInterval(async () => {
    if (!_foregroundData) return;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      await storePatrolLocation(loc, _foregroundData.patrolTag, _foregroundData.guard);
    } catch (e) {
      if (__DEV__) console.warn('[patrolForegroundPolling]', e);
    }
  }, PATROL_TIME_INTERVAL_MS);
}

export function stopPatrolForegroundPolling(): void {
  if (_foregroundInterval) {
    clearInterval(_foregroundInterval);
    _foregroundInterval = null;
  }
  _foregroundData = null;
}

// ---------- Watchdog ----------
export function startPatrolTrackingWatchdog(patrolTag: string, guard: string): void {
  stopPatrolTrackingWatchdog();
  _watchdogData = { patrolTag, guard };

  const tick = async () => {
    if (!_watchdogData || _watchdogBusy) return;
    _watchdogBusy = true;
    try {
      const active = await isPatrolTrackingActive();
      if (!active) {
        if (__DEV__) console.warn('[patrolWatchdog] restarting tracker');
        await startPatrolLocationUpdates(_watchdogData.patrolTag, _watchdogData.guard);
      }
    } finally {
      _watchdogBusy = false;
    }
  };

  _watchdogTimeout = setTimeout(() => {
    tick();
    _watchdogInterval = setInterval(tick, WATCHDOG_INTERVAL_MS);
  }, WATCHDOG_INITIAL_DELAY_MS);
}

export function stopPatrolTrackingWatchdog(): void {
  if (_watchdogTimeout) {
    clearTimeout(_watchdogTimeout);
    _watchdogTimeout = null;
  }
  if (_watchdogInterval) {
    clearInterval(_watchdogInterval);
    _watchdogInterval = null;
  }
  _watchdogData = null;
  _watchdogBusy = false;
}

// Restore active patrol cache on module load (helps when task fires before a screen mounts).
(async () => {
  try {
    const stored = await getActivePatrol();
    if (stored && !stored.stoppedAt) {
      _activePatrol = { patrolTag: stored.patrolTag, guard: stored.guard };
    }
  } catch {
    // ignore — DB init may not have run yet
  }
})();
