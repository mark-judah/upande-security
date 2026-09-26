import * as Haptics from 'expo-haptics';

/**
 * Announcement push receipt.
 *
 * Server side: upande_security/api/notifications.py (broadcast_notification),
 * sent to every registered device (e.g. "an app update is available").
 *
 * Client side is deliberately minimal - there's no natural in-app screen to
 * navigate to for a generic announcement. The OS-level notification banner
 * (already guaranteed by nearbyAlert.ts's `shouldShowBanner: true` handler)
 * is the actual delivery mechanism; this just adds a light haptic on top,
 * same de-dupe-within-2-seconds pattern as the other alert handlers. No
 * navigation, no toast, no in-app announcement history/list - out of scope.
 */

export type AnnouncementPushData = {
  type: 'announcement';
  title?: string;
  body?: string;
};

export function isAnnouncementPayload(data: unknown): data is AnnouncementPushData {
  return !!data && typeof data === 'object' && (data as { type?: unknown }).type === 'announcement';
}

let _handled = false;
let _handledResetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Handles an incoming `announcement` push payload with a light haptic and
 * nothing else. Safe to call multiple times for the same push (foreground
 * listener + tap response can both fire) - de-duplicated for a short window,
 * same as the other alert handlers in this chain.
 */
export function handleIncomingAnnouncementPush(data: unknown): void {
  if (!isAnnouncementPayload(data)) return;

  if (_handled) return;
  _handled = true;
  if (_handledResetTimer) clearTimeout(_handledResetTimer);
  _handledResetTimer = setTimeout(() => {
    _handled = false;
  }, 2000);

  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
