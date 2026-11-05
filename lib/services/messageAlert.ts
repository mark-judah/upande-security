import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { queryClient } from '@/lib/queryClient';

/**
 * Security message push (server: upande_security/api/messaging.py
 * push_message, data.type "security_message").
 *
 * Arriving while the app is open, it refreshes the conversation, the list
 * and the unread count with a light buzz - it never pulls the guard away
 * from what they are doing. Tapped (from the tray, or to start the app), it
 * opens that conversation ready for a reply.
 */

export type SecurityMessagePushData = {
  type: 'security_message';
  conversation: string;
  sender?: string;
};

export function isSecurityMessagePayload(data: unknown): data is SecurityMessagePushData {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as { type?: unknown }).type === 'security_message' &&
    typeof (data as { conversation?: unknown }).conversation === 'string'
  );
}

let _openedFor: string | null = null;
let _openedTimer: ReturnType<typeof setTimeout> | null = null;

export function handleSecurityMessagePush(data: SecurityMessagePushData, tapped: boolean): void {
  queryClient.invalidateQueries({ queryKey: ['messages', data.conversation] });
  queryClient.invalidateQueries({ queryKey: ['conversations'] });
  queryClient.invalidateQueries({ queryKey: ['unread-messages'] });

  if (!tapped) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return;
  }
  // The same tap can arrive twice (response listener + cold start).
  if (_openedFor === data.conversation) return;
  _openedFor = data.conversation;
  if (_openedTimer) clearTimeout(_openedTimer);
  _openedTimer = setTimeout(() => {
    _openedFor = null;
  }, 2000);
  try {
    router.push({ pathname: '/message-thread', params: { conversation: data.conversation } });
  } catch (e) {
    if (__DEV__) console.warn('[messageAlert] could not open the conversation:', e);
  }
}
