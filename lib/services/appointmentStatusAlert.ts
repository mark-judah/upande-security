import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { handleIncomingAnnouncementPush } from './announcementAlert';

/**
 * Appointment-status push receipt.
 *
 * Server side: upande_security/api/notifications.py
 * (notify_owner_on_status_change), fired on an Appointment's workflow_state
 * changing (approved/rejected/redirected/rescheduled by the secretary or
 * host), sent only to the specific guard who personally created that
 * Appointment (doc.owner).
 *
 * Client side mirrors visitorApprovedAlert.ts's pattern (haptic + best-effort
 * navigation on receipt/tap), routing to the Gate tab since checking a
 * visitor's updated status also happens from there.
 */

export type AppointmentStatusPushData = {
  type: 'appointment_status';
  appointment_name?: string;
  visitor_name?: string;
  workflow_state?: string;
};

export function isAppointmentStatusPayload(data: unknown): data is AppointmentStatusPushData {
  return !!data && typeof data === 'object' && (data as { type?: unknown }).type === 'appointment_status';
}

let _handled = false;
let _handledResetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Routes an incoming `appointment_status` push payload to the Gate tab.
 * Safe to call multiple times for the same push (foreground listener + tap
 * response can both fire) - de-duplicated for a short window, same as
 * visitorApprovedAlert.ts's handleIncomingVisitorApprovedPush.
 *
 * Not an appointment_status push? Hands off to announcementAlert.ts instead
 * of dropping it silently.
 */
export function handleIncomingAppointmentStatusPush(data: unknown): void {
  if (!isAppointmentStatusPayload(data)) {
    handleIncomingAnnouncementPush(data);
    return;
  }

  if (_handled) return;
  _handled = true;
  if (_handledResetTimer) clearTimeout(_handledResetTimer);
  _handledResetTimer = setTimeout(() => {
    _handled = false;
  }, 2000);

  const state = data.workflow_state ?? '';
  const hapticType = state.indexOf('Rejected') !== -1
    ? Haptics.NotificationFeedbackType.Warning
    : Haptics.NotificationFeedbackType.Success;
  Haptics.notificationAsync(hapticType).catch(() => {});

  try {
    router.push('/(tabs)/gate');
  } catch (e) {
    if (__DEV__) console.warn('[appointmentStatusAlert] failed to navigate to gate tab:', e);
  }
}
