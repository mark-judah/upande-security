import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, borderRadius, fontFamily, fontSize, shadow, spacing } from '@/src/core/theme';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  subscribeNotificationCenter,
  type StoredNotification,
} from '@/lib/services/notificationCenter';

const MAX_SHOWN = 10;

/** Tiny "5m ago" / "2h ago" / "Yesterday" / "3d ago" formatter. Kept local —
 *  nothing this small exists elsewhere in lib/utils/date.ts. */
function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return 'just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 2 * day) return 'Yesterday';
  return `${Math.floor(diffMs / day)}d ago`;
}

/**
 * Small bell icon + unread dot for the Screen header's right-hand spacer
 * slot. Tapping opens a small anchored dropdown listing the last few
 * locally-recorded push notifications (lib/services/notificationCenter.ts).
 *
 * Deliberately minimal per spec: no full-screen notification center, no
 * numeric badge (just a dot), no pagination.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StoredNotification[]>([]);

  useEffect(() => {
    // Subscribe first so a push arriving during the initial fetch is never
    // lost to it - if a live update lands before the fetch resolves, the
    // fetch's now-stale result is discarded instead of clobbering it.
    let liveUpdateReceived = false;
    const unsubscribe = subscribeNotificationCenter((n) => {
      liveUpdateReceived = true;
      setUnread(n);
    });
    getUnreadCount()
      .then((n) => {
        if (!liveUpdateReceived) setUnread(n);
      })
      .catch(() => {});
    return unsubscribe;
  }, []);

  const openDropdown = useCallback(() => {
    setOpen(true);
    getNotifications()
      .then((list) => setItems(list.slice(0, MAX_SHOWN)))
      .catch(() => setItems([]));
    markAllRead().catch(() => {});
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Pressable
        onPress={openDropdown}
        hitSlop={10}
        style={s.btn}
        accessibilityLabel="Notifications"
      >
        <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
        {unread > 0 ? <View style={s.dot} /> : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={s.overlay} onPress={close}>
          <Pressable style={s.card} onPress={() => {}}>
            <Text style={s.cardTitle}>Notifications</Text>
            {items.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>No notifications yet</Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                style={s.list}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={s.sep} />}
                renderItem={({ item }) => (
                  <View style={s.row}>
                    <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
                    {item.body ? (
                      <Text style={s.rowBody} numberOfLines={2}>{item.body}</Text>
                    ) : null}
                    <Text style={s.rowTime}>{relativeTime(item.receivedAt)}</Text>
                  </View>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn: { width: 32, alignItems: 'center', justifyContent: 'center', padding: 4 },
  dot: {
    position: 'absolute',
    top: 4,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
  },
  overlay: { flex: 1, backgroundColor: 'transparent' },
  card: {
    position: 'absolute',
    top: 56,
    right: spacing.lg,
    width: 280,
    maxHeight: 340,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingVertical: spacing.sm,
    ...shadow.md,
  },
  cardTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: COLORS.text,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  list: { paddingHorizontal: spacing.md },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: spacing.xs },
  row: { gap: 2 },
  rowTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text },
  rowBody: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textSecondary },
  rowTime: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
  empty: { paddingVertical: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textMuted },
});
