import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { addPatrolGpsPoints, getLatestPatrolGpsPoint } from './patrolDb';
import { flushAnyPendingPatrols } from './patrolGpsSync';
import { sanitizeGuardCode } from './patrolHelpers';
import { isPatrolTrackingActive } from './patrolTracking';
import { formatCapturedAt } from '@/lib/utils/haversine';

/**
 * On-duty location: while a guard is logged in but NOT patrolling, the phone
 * keeps sending its position every few minutes (Security Ops Settings >
 * On-Duty Position Interval) until they log out, so security can see what
 * happens between patrols.
 *
 * Points go through the same offline queue and upload as patrol points, under
 * a per-guard, per-day tag starting with DUTY_TAG_PREFIX; the upload marks
 * them mode=on_duty and the server stores them as "On Duty", never as patrol
 * work. The server says whether it supports this (session info
 * `on_duty_tracking`); without that the tracker never starts, so this can ship
 * before the server deploy.
 *
 * Steps aside while a patrol runs (the patrol tracker is far more detailed)
 * and resumes when it stops. Guards see an "On duty" notification the whole
 * time - Android requires it for background location, and it must stay.
 */

export const DUTY_LOCATION_TASK = 'duty-location-task';
export const DUTY_TAG_PREFIX = 'DUTY-';

const STATE_KEY = 'duty_tracking_state';
// The map drops fixes coarser than this; no point queueing them.
const MAX_ACCURACY_M = 100;

type DutyState = { user: string; intervalMinutes: number };

let _state: DutyState | null = null;

export function dutyTagFor(user: string, at: Date = new Date()): string {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${DUTY_TAG_PREFIX}${sanitizeGuardCode(user)}-${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
}

export function isDutyTag(tag: string | null | undefined): boolean {
  return !!tag && tag.startsWith(DUTY_TAG_PREFIX);
}

async function loadState(): Promise<DutyState | null> {
  if (_state) return _state;
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    _state = raw ? (JSON.parse(raw) as DutyState) : null;
  } catch {
    _state = null;
  }
  return _state;
}

async function saveState(state: DutyState | null): Promise<void> {
  _state = state;
  if (state) await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
  else await AsyncStorage.removeItem(STATE_KEY);
}

// ---------- Background task ----------
TaskManager.defineTask(DUTY_LOCATION_TASK, async (payload) => {
  try {
    if (payload.error) return;
    const locations =
      (payload.data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
    if (!locations.length) return;

    const state = await loadState();
    if (!state) return;

    // Android may deliver fixes more often than asked when another app wants
    // location; keep roughly one per interval.
    const minGapMs = state.intervalMinutes * 60_000 * 0.8;
    const points = [];
    for (const loc of locations) {
      const { latitude, longitude, accuracy } = loc.coords;
      if (latitude == null || longitude == null) continue;
      if (accuracy != null && accuracy > MAX_ACCURACY_M) continue;
      const tag = dutyTagFor(state.user, new Date(loc.timestamp));
      const last = await getLatestPatrolGpsPoint(tag);
      if (last) {
        const lastTs = Date.parse(last.capturedAt.replace(' ', 'T'));
        if (Number.isFinite(lastTs) && loc.timestamp - lastTs < minGapMs) continue;
      }
      points.push({
        patrolTag: tag,
        clientId: null,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        capturedAt: formatCapturedAt(loc.timestamp),
      });
    }
    if (points.length) await addPatrolGpsPoints(points);

    // The app may be in the background for hours - upload from here rather
    // than waiting for it to be opened. Offline: stays queued, retried later.
    await flushAnyPendingPatrols();
  } catch (e) {
    if (__DEV__) console.warn('[duty-location-task]', e);
  }
});

// ---------- Lifecycle ----------
async function isDutyTaskRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(DUTY_LOCATION_TASK);
  } catch {
    return false;
  }
}

async function startTask(intervalMinutes: number): Promise<boolean> {
  const ms = Math.max(intervalMinutes, 1) * 60_000;
  try {
    await Location.startLocationUpdatesAsync(DUTY_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 0,
      timeInterval: ms,
      deferredUpdatesInterval: ms,
      deferredUpdatesDistance: 0,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'On duty',
        notificationBody: 'Your location is shared with security until you log out.',
        notificationColor: '#000000',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[dutyTracking] start failed', e);
    return false;
  }
}

async function stopTask(): Promise<void> {
  try {
    if (await isDutyTaskRunning()) await Location.stopLocationUpdatesAsync(DUTY_LOCATION_TASK);
  } catch (e) {
    if (__DEV__) console.warn('[dutyTracking] stop failed', e);
  }
}

/** Turn on-duty tracking on for this login (or keep it on), unless a patrol
 *  is running - then it waits and resumeDutyTracking() picks it up. */
export async function ensureDutyTracking(user: string, intervalMinutes: number): Promise<boolean> {
  if (!user) return false;
  const previous = await loadState();
  await saveState({ user, intervalMinutes });
  if (await isPatrolTrackingActive()) return false;

  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  if (fg.status !== 'granted' || bg.status !== 'granted') {
    const f = fg.status === 'granted' ? fg : await Location.requestForegroundPermissionsAsync();
    if (f.status !== 'granted') return false;
    const b = bg.status === 'granted' ? bg : await Location.requestBackgroundPermissionsAsync();
    if (b.status !== 'granted') return false;
  }

  const running = await isDutyTaskRunning();
  if (running && previous?.intervalMinutes === intervalMinutes && previous?.user === user) return true;
  if (running) await stopTask();
  return startTask(intervalMinutes);
}

/** A patrol is starting: stop the on-duty tracker but remember it is on. */
export async function pauseDutyTracking(): Promise<void> {
  await stopTask();
}

/** A patrol stopped: carry on with on-duty tracking if this login has it. */
export async function resumeDutyTracking(): Promise<void> {
  const state = await loadState();
  if (state) await ensureDutyTracking(state.user, state.intervalMinutes);
}

/** Logged out, or switched off in Security Ops Settings. */
export async function stopDutyTracking(): Promise<void> {
  await stopTask();
  await saveState(null);
  flushAnyPendingPatrols().catch(() => {});
}
