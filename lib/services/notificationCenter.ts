import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny on-device notification history backing the bell icon in
 * `src/core/ui/NotificationBell.tsx`.
 *
 * Deliberately dumb: no server sync, no read receipts sent anywhere, just
 * the last MAX_ENTRIES incoming push payloads (of any type) kept locally so
 * a guard can glance back at what they missed. This is a nice-to-have UI
 * feature — every read/write is wrapped in try/catch and degrades to a
 * silent no-op on failure rather than ever throwing or blocking a caller
 * (e.g. the push-notification listener in nearbyAlert.ts).
 */

export type StoredNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  receivedAt: number;
  read: boolean;
};

const STORAGE_KEY = 'notificationCenter:history';
const MAX_ENTRIES = 20;

const _subscribers = new Set<(unreadCount: number) => void>();

function notify(unreadCount: number) {
  for (const cb of _subscribers) {
    try {
      cb(unreadCount);
    } catch {
      // ignore subscriber errors
    }
  }
}

function countUnread(list: StoredNotification[]): number {
  return list.reduce((n, item) => (item.read ? n : n + 1), 0);
}

async function readAll(): Promise<StoredNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredNotification[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(list: StoredNotification[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // best-effort — worst case this notification just doesn't persist
  }
}

// Promise-chain mutex — same idiom as patrolDb.ts's withPatrolGpsQueueLock.
// Without it, a read-then-write from addNotification racing a concurrent
// markAllRead (or two addNotification calls back to back) can clobber each
// other's write with a stale read, silently dropping an entry.
let _lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = _lock.then(fn, fn);
  _lock = next.catch(() => undefined);
  return next;
}

/**
 * Records a newly-received push notification, newest-first, capped at the
 * last MAX_ENTRIES. Notifies any subscribed bell badges with the new
 * unread count.
 */
export async function addNotification(n: {
  type: string;
  title: string;
  body: string;
}): Promise<void> {
  try {
    const next = await withLock(async () => {
      const list = await readAll();
      const entry: StoredNotification = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: n.type,
        title: n.title,
        body: n.body,
        receivedAt: Date.now(),
        read: false,
      };
      const updated = [entry, ...list].slice(0, MAX_ENTRIES);
      await writeAll(updated);
      return updated;
    });
    notify(countUnread(next));
  } catch {
    // never let a notification-recording failure surface to the caller
  }
}

/** Returns the stored history, newest first. */
export async function getNotifications(): Promise<StoredNotification[]> {
  return readAll();
}

/** Returns just the unread count, for the bell badge dot. */
export async function getUnreadCount(): Promise<number> {
  const list = await readAll();
  return countUnread(list);
}

/** Marks every stored notification read (e.g. on opening the bell dropdown). */
export async function markAllRead(): Promise<void> {
  try {
    const list = await readAll();
    if (list.length === 0 || list.every((item) => item.read)) return;
    const next = list.map((item) => ({ ...item, read: true }));
    await writeAll(next);
    notify(0);
  } catch {
    // ignore — worst case the badge stays lit until the next successful call
  }
}

/**
 * Subscribes to live unread-count updates (fired on addNotification and
 * markAllRead) so the bell badge doesn't need to poll. Same pub-sub idiom
 * as `subscribePatrolSyncStatus` in patrolGpsSync.ts. Returns an unsubscribe
 * function.
 */
export function subscribeNotificationCenter(cb: (unreadCount: number) => void): () => void {
  _subscribers.add(cb);
  return () => {
    _subscribers.delete(cb);
  };
}
