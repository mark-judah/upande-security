import * as SQLite from 'expo-sqlite';

export type PatrolGpsPoint = {
  id?: number;
  patrolTag: string;
  clientId: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
  synced?: 0 | 1;
};

export type ActivePatrol = {
  patrolTag: string;
  guard: string;
  startedAt: string;
  stoppedAt: string | null;
};

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS patrol_gps_queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    patrol_tag  TEXT NOT NULL,
    client_id   TEXT,
    latitude    REAL NOT NULL,
    longitude   REAL NOT NULL,
    accuracy    REAL,
    captured_at TEXT NOT NULL,
    synced      INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_patrol_queue_tag_synced
    ON patrol_gps_queue (patrol_tag, synced);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_patrol_queue_client_id_unique
    ON patrol_gps_queue (client_id)
    WHERE client_id IS NOT NULL AND client_id <> '';
  CREATE TABLE IF NOT EXISTS active_patrol (
    id          INTEGER PRIMARY KEY,
    patrol_tag  TEXT NOT NULL,
    guard       TEXT NOT NULL,
    started_at  TEXT NOT NULL,
    stopped_at  TEXT,
    updated_at  INTEGER NOT NULL
  );
`;

let _db: SQLite.SQLiteDatabase | null = null;
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndInitDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('location.db');
  await db.execAsync(SCHEMA_SQL);
  return db;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  // Health-check cached handle — background tasks sometimes wake up with a
  // stale native reference (NPE from prepareAsync). Reopen if it's invalid.
  if (_db) {
    try {
      await _db.getFirstAsync('SELECT 1');
      return _db;
    } catch {
      _db = null;
      _dbPromise = null;
    }
  }
  if (!_dbPromise) {
    _dbPromise = openAndInitDb()
      .then((db) => {
        _db = db;
        return db;
      })
      .catch((err) => {
        _dbPromise = null;
        throw err;
      });
  }
  return _dbPromise;
}

// Promise-chain mutex to serialize all writes to patrol_gps_queue.
let _patrolGpsQueueLock: Promise<unknown> = Promise.resolve();
function withPatrolGpsQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = _patrolGpsQueueLock.then(fn, fn);
  _patrolGpsQueueLock = next.catch(() => undefined);
  return next;
}

export async function initPatrolDb(): Promise<void> {
  await getDb();
}

export function computePatrolGpsClientId(input: {
  patrolTag: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
}): string {
  const lat = input.latitude.toFixed(6);
  const lng = input.longitude.toFixed(6);
  return `${input.patrolTag}|${input.capturedAt}|${lat}|${lng}`;
}

export async function addPatrolGpsPoint(
  point: Omit<PatrolGpsPoint, 'id' | 'synced'>,
): Promise<void> {
  return addPatrolGpsPoints([point]);
}

export async function addPatrolGpsPoints(
  points: Omit<PatrolGpsPoint, 'id' | 'synced'>[],
): Promise<void> {
  if (!points.length) return;
  return withPatrolGpsQueueLock(async () => {
    const db = await getDb();
    for (const p of points) {
      const clientId =
        p.clientId ||
        computePatrolGpsClientId({
          patrolTag: p.patrolTag,
          capturedAt: p.capturedAt,
          latitude: p.latitude,
          longitude: p.longitude,
        });
      await db.runAsync(
        `INSERT OR IGNORE INTO patrol_gps_queue
         (patrol_tag, client_id, latitude, longitude, accuracy, captured_at, synced)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [p.patrolTag, clientId, p.latitude, p.longitude, p.accuracy, p.capturedAt],
      );
    }
  });
}

export async function getPendingPatrolGpsPoints(
  patrolTag: string,
  limit = 25,
): Promise<PatrolGpsPoint[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    patrol_tag: string;
    client_id: string | null;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    captured_at: string;
    synced: 0 | 1;
  }>(
    `SELECT id, patrol_tag, client_id, latitude, longitude, accuracy, captured_at, synced
     FROM patrol_gps_queue
     WHERE patrol_tag = ? AND synced = 0
     ORDER BY captured_at ASC
     LIMIT ?`,
    [patrolTag, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    patrolTag: r.patrol_tag,
    clientId: r.client_id,
    latitude: r.latitude,
    longitude: r.longitude,
    accuracy: r.accuracy,
    capturedAt: r.captured_at,
    synced: r.synced,
  }));
}

export async function getLatestPatrolGpsPoint(
  patrolTag?: string,
): Promise<PatrolGpsPoint | null> {
  const db = await getDb();
  const sql = patrolTag
    ? `SELECT id, patrol_tag, client_id, latitude, longitude, accuracy, captured_at, synced
       FROM patrol_gps_queue
       WHERE patrol_tag = ?
       ORDER BY captured_at DESC
       LIMIT 1`
    : `SELECT id, patrol_tag, client_id, latitude, longitude, accuracy, captured_at, synced
       FROM patrol_gps_queue
       ORDER BY captured_at DESC
       LIMIT 1`;
  const params = patrolTag ? [patrolTag] : [];
  const r = await db.getFirstAsync<{
    id: number;
    patrol_tag: string;
    client_id: string | null;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    captured_at: string;
    synced: 0 | 1;
  }>(sql, params);
  if (!r) return null;
  return {
    id: r.id,
    patrolTag: r.patrol_tag,
    clientId: r.client_id,
    latitude: r.latitude,
    longitude: r.longitude,
    accuracy: r.accuracy,
    capturedAt: r.captured_at,
    synced: r.synced,
  };
}

export async function getPatrolGpsQueueCount(
  patrolTag: string,
): Promise<{ pending: number; total: number }> {
  const db = await getDb();
  const pendingRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM patrol_gps_queue WHERE patrol_tag = ? AND synced = 0`,
    [patrolTag],
  );
  const totalRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM patrol_gps_queue WHERE patrol_tag = ?`,
    [patrolTag],
  );
  return { pending: pendingRow?.c ?? 0, total: totalRow?.c ?? 0 };
}

export async function markPatrolGpsPointsSynced(ids: number[]): Promise<void> {
  if (!ids.length) return;
  return withPatrolGpsQueueLock(async () => {
    const db = await getDb();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE patrol_gps_queue SET synced = 1 WHERE id IN (${placeholders})`,
      ids,
    );
  });
}

export async function deleteSyncedPatrolGpsPoints(): Promise<void> {
  return withPatrolGpsQueueLock(async () => {
    const db = await getDb();
    await db.runAsync(`DELETE FROM patrol_gps_queue WHERE synced = 1`);
  });
}

export async function saveActivePatrol(patrol: ActivePatrol): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO active_patrol (id, patrol_tag, guard, started_at, stopped_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       patrol_tag = excluded.patrol_tag,
       guard = excluded.guard,
       started_at = excluded.started_at,
       stopped_at = excluded.stopped_at,
       updated_at = excluded.updated_at`,
    [
      patrol.patrolTag,
      patrol.guard,
      patrol.startedAt,
      patrol.stoppedAt,
      Date.now(),
    ],
  );
}

export async function getActivePatrol(): Promise<ActivePatrol | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{
    patrol_tag: string;
    guard: string;
    started_at: string;
    stopped_at: string | null;
  }>(
    `SELECT patrol_tag, guard, started_at, stopped_at FROM active_patrol WHERE id = 1`,
  );
  if (!r) return null;
  return {
    patrolTag: r.patrol_tag,
    guard: r.guard,
    startedAt: r.started_at,
    stoppedAt: r.stopped_at,
  };
}

export async function markPatrolStopped(stoppedAt: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE active_patrol SET stopped_at = ?, updated_at = ? WHERE id = 1`,
    [stoppedAt, Date.now()],
  );
}

export async function clearActivePatrol(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM active_patrol WHERE id = 1`);
}
