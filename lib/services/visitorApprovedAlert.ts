import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

/**
 * Visitor-approved gate alert receipt.
 *
 * Server side: upande_security/api/visitor_approved_alert.py, fired on
 * Appointment's workflow_state reaching "Approved by Host", farm-scoped to
 * Guard Device Tokens at the same farm (see that module's docstring).
 *
 * Client side mirrors nearbyAlert.ts's SOS pattern (haptic + best-effort
 * navigation on receipt/tap), but routes to the Gate tab instead of a
 * full-screen alert screen - this is "go check someone in", not "respond
 * to an emergency".
 */

export type VisitorApprovedPushData = {
  type: 'visitor_approved';
  appointment_name?: string;
  visitor_name?: string;
  host_name?: string;
  farm?: string;
};

export function isVisitorApprovedPayload(data: unknown): data is VisitorApprovedPushData {
  return !!data && typeof data === 'object' && (data as { type?: unknown }).type === 'visitor_approved';
}

let _handled = false;
let _handledResetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Routes an incoming `visitor_approved` push payload to the Gate tab.
 * Safe to call multiple times for the same push (foreground listener + tap
 * response can both fire) - de-duplicated for a short window, same as
 * nearbyAlert.ts's handleIncomingPush.
 */
export function handleIncomingVisitorApprovedPush(data: unknown): void {
  if (!isVisitorApprovedPayload(data)) return;

  if (_handled) return;
  _handled = true;
  if (_handledResetTimer) clearTimeout(_handledResetTimer);
  _handledResetTimer = setTimeout(() => {
    _handled = false;
  }, 2000);

  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

  try {
    router.push('/(tabs)/gate');
  } catch (e) {
    if (__DEV__) console.warn('[visitorApprovedAlert] failed to navigate to gate tab:', e);
  }
}
