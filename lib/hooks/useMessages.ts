import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ConversationRow, type ConversationThread, type MessageContact } from '@/lib/services/api';
import { useAuthStore } from '@/lib/stores/authStore';

/** Security messages. A push for a new message refreshes these at once
 *  (lib/services/messageAlert.ts); the intervals are the fallback. */

export function useConversations() {
  return useQuery<ConversationRow[]>({
    queryKey: ['conversations'],
    queryFn: () => api.listConversations(),
    refetchInterval: 30_000,
  });
}

export function useUnreadMessages() {
  const hasSession = useAuthStore((st) => st.hasSession);
  return useQuery<{ unread: number }>({
    queryKey: ['unread-messages'],
    queryFn: () => api.unreadMessages(),
    refetchInterval: 60_000,
    enabled: hasSession,
  });
}

/** One conversation's messages, refreshed every few seconds while it is
 *  open - opening it also marks it read. */
export function useThread(conversation: string | undefined) {
  return useQuery<ConversationThread>({
    queryKey: ['messages', conversation],
    queryFn: () => api.getMessages(conversation as string),
    enabled: !!conversation,
    refetchInterval: 5_000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { body: string; conversation?: string; to?: string | string[] }) => api.sendMessage(args),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['messages', res.conversation] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useMessageContacts(query: string) {
  return useQuery<MessageContact[]>({
    queryKey: ['message-contacts', query],
    queryFn: () => api.messageContacts(query),
    staleTime: 5 * 60 * 1000,
  });
}
