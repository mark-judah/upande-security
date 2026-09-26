import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import {
  deleteSyncedPatrolGpsPoints,
  getActivePatrol,
  getAllPendingPatrolTags,
  getPatrolGpsQueueCount,
  getPendingPatrolGpsPoints,
  markPatrolGpsPointsSynced,
} from './patrolDb';
import { uploadPatrolGps, type PatrolGpsPayload } from '@/lib/api/patrol';

export type PatrolSyncStatus = {
  patrolTag: string | null;
  pending: number;
  lastSyncAt: number | null;
  lastError: string | null;
};

const SYNC_INTERVAL_MS = 120_000;
const BATCH_SIZE = 20;

let _patrolTag: string | null = null;
let _interval: ReturnType<typeof setInterval> | null = null;
let _appStateSub: NativeEventSubscription | null = null;
let _busy = false;

const _subscribers = new Set<(status: PatrolSyncStatus) => void>();
let _status: PatrolSyncStatus = {
  patrolTag: null,
  pending: 0,
  lastSyncAt: null,
  lastError: null,
};

function notify() {
  for (const cb of _subscribers) {
    try {
      cb(_status);
    } catch {
      // ignore subscriber errors
    }
  }
}

function updateStatus(next: Partial<PatrolSyncStatus>) {
  _status = { ..._status, ...next };
  notify();
}

export function subscribePatrolSyncStatus(
  cb: (status: PatrolSyncStatus) => void,
): () => void {
  _subscribers.add(cb);
  cb(_status);
  return () => {
    _subscribers.delete(cb);
  };
}

export async function syncPatrolQueueNow(
  patrolTag: string,
): Promise<{ uploaded: number; pending: number }> {
  if (__DEV__) console.log('[patrolSync] fire', patrolTag);
  if (_busy) {
    if (__DEV__) console.log('[patrolSync] busy — skipping');
    const counts = await getPatrolGpsQueueCount(patrolTag);
    return { uploaded: 0, pending: counts.pending };
  }
  _busy = true;
  try {
    const points = await getPendingPatrolGpsPoints(patrolTag, BATCH_SIZE);
    if (__DEV__) console.log('[patrolSync] pending rows read:', points.length);
    if (!points.length) {
      const counts = await getPatrolGpsQueueCount(patrolTag);
      updateStatus({ patrolTag, pending: counts.pending, lastSyncAt: Date.now(), lastError: null });
      return { uploaded: 0, pending: counts.pending };
    }

    const active = await getActivePatrol();
    const guardCode = active?.guard ?? '';

    const payload: PatrolGpsPayload[] = points.map((p) => ({
      client_id: p.clientId ?? '',
      patrol_tag: p.patrolTag,
      guard: guardCode,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy,
      captured_at: p.capturedAt,
    }));

    try {
      if (__DEV__) console.log('[patrolSync] POST', payload.length, 'points');
      const results = await uploadPatrolGps(payload);
      if (__DEV__) console.log('[patrolSync] server returned', results.length, 'results');
      const successfulIds: number[] = [];
      results.forEach((r, i) => {
        if (r.status === 'success') {
          const id = points[i]?.id;
          if (typeof id === 'number') successfulIds.push(id);
        }
      });
      if (successfulIds.length) {
        await markPatrolGpsPointsSynced(successfulIds);
      }
      await deleteSyncedPatrolGpsPoints();
      const counts = await getPatrolGpsQueueCount(patrolTag);
      if (__DEV__) console.log('[patrolSync] uploaded', successfulIds.length, 'pending now', counts.pending);
      updateStatus({
        patrolTag,
        pending: counts.pending,
        lastSyncAt: Date.now(),
        lastError: null,
      });
      return { uploaded: successfulIds.length, pending: counts.pending };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      if (__DEV__) console.warn('[patrolSync] upload failed:', message);
      const counts = await getPatrolGpsQueueCount(patrolTag);
      updateStatus({ patrolTag, pending: counts.pending, lastError: message });
      return { uploaded: 0, pending: counts.pending };
    }
  } finally {
    _busy = false;
  }
}

export function startPatrolSync(patrolTag: string): void {
  stopPatrolSync();
  _patrolTag = patrolTag;
  updateStatus({ patrolTag });
  syncPatrolQueueNow(patrolTag).catch(() => {});
  _interval = setInterval(() => {
    if (_patrolTag) syncPatrolQueueNow(_patrolTag).catch(() => {});
  }, SYNC_INTERVAL_MS);
  _appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active' && _patrolTag) {
      syncPatrolQueueNow(_patrolTag).catch(() => {});
    }
  });
}

/**
 * Watchdog — verify the 2-minute sync loop is actually running for this tag.
 * Cheap to call repeatedly: no-ops if the same loop is already active.
 * The active patrol screen calls this on mount; AppState transitions call it too.
 */
/**
 * Drain the entire pending queue for this patrol in one go (used by the SOS
 * trigger — we want to flush everything, not wait for the next 2-minute tick).
 * Loops syncPatrolQueueNow until the queue is empty, the server returns zero
 * uploads in a cycle, or we hit the safety cap.
 */
export async function flushAllPatrolPending(
  patrolTag: string,
): Promise<{ uploaded: number; pending: number }> {
  let totalUploaded = 0;
  let lastPending = 0;
  for (let i = 0; i < 20; i++) {
    const res = await syncPatrolQueueNow(patrolTag);
    totalUploaded = totalUploaded + res.uploaded;
    lastPending = res.pending;
    if (res.pending === 0 || res.uploaded === 0) break;
  }
  return { uploaded: totalUploaded, pending: lastPending };
}

let _sweepRunning = false;

// Drains every patrol_tag that still has pending points, not just the
// current active one. Covers a patrol that was stopped (or auto-cleared as
// stale) before its full backlog finished uploading - stopping/starting a
// new patrol switches active_patrol to a new tag, and nothing else ever
// looks at the old one again unless something sweeps for it. Safe to call
// often: flushAllPatrolPending is itself a no-op once a tag's queue is
// empty, and this whole sweep short-circuits if a previous call is still
// in flight.
export async function flushAnyPendingPatrols(): Promise<void> {
  if (_sweepRunning) return;
  _sweepRunning = true;
  try {
    const tags = await getAllPendingPatrolTags();
    for (const tag of tags) {
      try {
        await flushAllPatrolPending(tag);
      } catch {
        // move on to the next tag - one bad tag shouldn't block the rest
      }
    }
  } catch {
    // ignore - next sweep will retry
  } finally {
    _sweepRunning = false;
  }
}

export function ensurePatrolSyncRunning(patrolTag: string): void {
  if (_interval && _patrolTag === patrolTag) return;
  startPatrolSync(patrolTag);
}

export function isPatrolSyncRunning(patrolTag?: string): boolean {
  if (!_interval) return false;
  if (patrolTag && _patrolTag !== patrolTag) return false;
  return true;
}

export function stopPatrolSync(): void {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
  if (_appStateSub) {
    _appStateSub.remove();
    _appStateSub = null;
  }
  _patrolTag = null;
}

const ORPHAN_SWEEP_INTERVAL_MS = 120_000;

// Runs independently of any single active patrol - covers points left
// behind by a stop/stale-clear that happened before this JS instance ever
// loaded (an OTA reload, a crash, the app being killed and relaunched).
// Fires once immediately on module load, then on the same cadence as the
// per-patrol sync loop.
flushAnyPendingPatrols().catch(() => {});
setInterval(() => {
  flushAnyPendingPatrols().catch(() => {});
}, ORPHAN_SWEEP_INTERVAL_MS);
AppState.addEventListener('change', (state: AppStateStatus) => {
  if (state === 'active') flushAnyPendingPatrols().catch(() => {});
});
