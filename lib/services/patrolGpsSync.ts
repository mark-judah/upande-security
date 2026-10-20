import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import {
  bumpPatrolGpsAttempts,
  deleteSyncedPatrolGpsPoints,
  getActivePatrol,
  getAllPatrolGpsPendingCount,
  getAllPendingPatrolTags,
  getPatrolGpsQueueCount,
  getPendingPatrolGpsPoints,
  markPatrolGpsPointsSynced,
} from './patrolDb';
import { uploadPatrolGps, type PatrolGpsPayload } from '@/lib/api/patrol';

// Kept here, not imported from dutyTracking.ts, which imports this module.
const DUTY_TAG_PREFIX = 'DUTY-';

export type PatrolSyncStatus = {
  patrolTag: string | null;
  pending: number;
  lastSyncAt: number | null;
  lastError: string | null;
};

const SYNC_INTERVAL_MS = 120_000;
// Points per request. A patrol logs hundreds, so draining loops over
// batches; 50 keeps one request well inside the 30s HTTP timeout on a
// weak farm connection (the server skips points it already has, so a
// batch that timed out after landing is safe to resend).
const BATCH_SIZE = 50;
// Upper bound on batches per drain - 25,000 points - so a server that
// keeps answering without taking anything can never spin forever.
const MAX_BATCHES = 500;

let _patrolTag: string | null = null;
let _interval: ReturnType<typeof setInterval> | null = null;
let _appStateSub: NativeEventSubscription | null = null;

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

async function refreshPendingCount(): Promise<number> {
  const pending = await getAllPatrolGpsPendingCount();
  updateStatus({ pending });
  return pending;
}

export function subscribePatrolSyncStatus(
  cb: (status: PatrolSyncStatus) => void,
): () => void {
  _subscribers.add(cb);
  cb(_status);
  refreshPendingCount().catch(() => {});
  return () => {
    _subscribers.delete(cb);
  };
}

// Every upload - the 2-minute loop, the background sweep, Sync Now, Stop,
// SOS - runs one batch at a time through this chain. A second caller waits
// its turn instead of being skipped (it used to return "uploaded 0", which
// is why guards kept pressing Sync Now), and two callers can never send
// the same points at once.
let _uploadChain: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = _uploadChain.then(fn, fn);
  _uploadChain = next.catch(() => undefined);
  return next;
}

type BatchResult = { uploaded: number; sent: number; pending: number; error: string | null };

function uploadOneBatch(patrolTag: string): Promise<BatchResult> {
  return serialized(async () => {
    const points = await getPendingPatrolGpsPoints(patrolTag, BATCH_SIZE);
    if (!points.length) {
      const counts = await getPatrolGpsQueueCount(patrolTag);
      return { uploaded: 0, sent: 0, pending: counts.pending, error: null };
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
      ...(p.patrolTag.startsWith(DUTY_TAG_PREFIX) ? { mode: 'on_duty' as const } : {}),
    }));

    try {
      if (__DEV__) console.log('[patrolSync] POST', payload.length, 'points for', patrolTag);
      const results = await uploadPatrolGps(payload);
      const successfulIds: number[] = [];
      const refusedIds: number[] = [];
      points.forEach((p, i) => {
        if (typeof p.id !== 'number') return;
        if (results[i]?.status === 'success') successfulIds.push(p.id);
        else refusedIds.push(p.id);
      });
      await markPatrolGpsPointsSynced(successfulIds);
      await bumpPatrolGpsAttempts(refusedIds);
      await deleteSyncedPatrolGpsPoints();
      const counts = await getPatrolGpsQueueCount(patrolTag);
      return { uploaded: successfulIds.length, sent: points.length, pending: counts.pending, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      if (__DEV__) console.warn('[patrolSync] upload failed:', message);
      const counts = await getPatrolGpsQueueCount(patrolTag);
      return { uploaded: 0, sent: points.length, pending: counts.pending, error: message };
    }
  });
}

async function recordResult(error: string | null): Promise<void> {
  const pending = await getAllPatrolGpsPendingCount().catch(() => _status.pending);
  updateStatus(
    error ? { pending, lastError: error } : { pending, lastSyncAt: Date.now(), lastError: null },
  );
}

/** One batch for this patrol - the 2-minute loop's tick. */
export async function syncPatrolQueueNow(
  patrolTag: string,
): Promise<{ uploaded: number; pending: number }> {
  const res = await uploadOneBatch(patrolTag);
  await recordResult(res.error);
  return { uploaded: res.uploaded, pending: res.pending };
}

/**
 * Upload this patrol's whole backlog, batch after batch, until it is empty.
 * Stops early only when the network fails, or every point left has been
 * refused by the server this run (those stay queued and are retried on the
 * next sync - they are never dropped).
 */
export async function flushAllPatrolPending(
  patrolTag: string,
  onProgress?: (uploaded: number) => void,
): Promise<{ uploaded: number; pending: number; error: string | null }> {
  let uploaded = 0;
  let pending = 0;
  let error: string | null = null;
  // Points refused in a row. Refused points move to the back, so once this
  // covers everything still pending, all of it has been tried this run.
  let refusedInRow = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const res = await uploadOneBatch(patrolTag);
    uploaded += res.uploaded;
    pending = res.pending;
    error = res.error;
    if (res.uploaded) onProgress?.(uploaded);
    refusedInRow = res.uploaded ? 0 : refusedInRow + res.sent;
    if (res.error || res.pending === 0 || res.sent === 0 || refusedInRow >= res.pending) break;
  }
  await recordResult(error);
  return { uploaded, pending, error };
}

/**
 * Sync Now: upload every patrol's pending points - the current patrol and
 * any earlier ones still holding data - in one press.
 */
export async function syncAllPatrolDataNow(
  onProgress?: (uploaded: number, pending: number) => void,
): Promise<{ uploaded: number; pending: number; error: string | null }> {
  let total = 0;
  let error: string | null = null;
  const startPending = await getAllPatrolGpsPendingCount();
  const tags = await getAllPendingPatrolTags();
  for (const tag of tags) {
    const before = total;
    const res = await flushAllPatrolPending(tag, (n) => {
      onProgress?.(before + n, Math.max(0, startPending - before - n));
    });
    total += res.uploaded;
    if (res.error) {
      error = res.error;
      break; // offline - no point trying the other patrols now
    }
  }
  const pending = await getAllPatrolGpsPendingCount();
  updateStatus({ pending });
  return { uploaded: total, pending, error };
}

export function startPatrolSync(patrolTag: string): void {
  stopPatrolSync();
  _patrolTag = patrolTag;
  updateStatus({ patrolTag });
  // Each tick drains the whole backlog, not one batch - a long patrol
  // otherwise logs points faster than one batch per tick can send them.
  flushAllPatrolPending(patrolTag).catch(() => {});
  _interval = setInterval(() => {
    if (_patrolTag) flushAllPatrolPending(_patrolTag).catch(() => {});
  }, SYNC_INTERVAL_MS);
  _appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active' && _patrolTag) {
      flushAllPatrolPending(_patrolTag).catch(() => {});
    }
  });
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
    await syncAllPatrolDataNow();
  } catch {
    // ignore - next sweep will retry
  } finally {
    _sweepRunning = false;
  }
}

/**
 * Watchdog - verify the 2-minute sync loop is actually running for this tag.
 * Cheap to call repeatedly: no-ops if the same loop is already active.
 */
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
