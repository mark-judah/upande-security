import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/src/core/ui/Screen';
import { useSendMessage, useThread } from '@/lib/hooks/useMessages';
import { useFeedback } from '@/lib/hooks/useFeedback';
import type { ChatMessage } from '@/lib/services/api';
import { fmtDateTime } from '@/lib/utils/date';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// One conversation: its messages (newest at the bottom) and a reply box.
// Opened from Messages, from New message (to / toName, before the first
// message creates the conversation) or by tapping a message notification.
// Opening it marks it read on the server.

export default function MessageThreadScreen() {
  const params = useLocalSearchParams<{ conversation?: string; to?: string; toName?: string }>();
  const [conversation, setConversation] = useState<string | undefined>(params.conversation || undefined);
  const [text, setText] = useState('');
  const { data, isLoading, error, refetch } = useThread(conversation);
  const send = useSendMessage();
  const feedback = useFeedback();
  const qc = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Opening it reads it: refresh the badge and the list too.
  useEffect(() => {
    if (data) {
      qc.invalidateQueries({ queryKey: ['unread-messages'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [data?.messages.length, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = data?.title || params.toName || 'Message';
  const isGroup = data?.type === 'Group';
  const messages = [...(data?.messages ?? [])].reverse(); // inverted list: newest first

  const onSend = async () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    try {
      const res = await send.mutateAsync(
        conversation ? { body, conversation } : { body, to: params.to as string },
      );
      setText('');
      if (!conversation) {
        setConversation(res.conversation);
        router.setParams({ conversation: res.conversation });
      }
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Could not send');
    }
  };

  return (
    <Screen
      title={title}
      scroll={false}
      contentPadded={false}
      footer={
        <View style={s.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={2000}
            style={s.input}
          />
          <Pressable
            onPress={onSend}
            disabled={!text.trim() || send.isPending}
            style={[s.sendBtn, (!text.trim() || send.isPending) && { opacity: 0.4 }]}
            accessibilityLabel="Send message"
          >
            {send.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      }
    >
      {conversation && isLoading && !data ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.text} />
        </View>
      ) : conversation && error && !data ? (
        <Pressable style={s.center} onPress={() => refetch()}>
          <Text style={s.errorText}>{error instanceof Error ? error.message : 'Could not load messages'}</Text>
          <Text style={s.hint}>Tap to try again</Text>
        </Pressable>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          inverted
          keyExtractor={(m) => m.name}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={[s.center, { transform: [{ scaleY: -1 }] }]}>
              <Text style={s.hint}>No messages yet. Say hello.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[s.bubbleRow, item.mine ? s.mineRow : s.theirsRow]}>
              <View style={[s.bubble, item.mine ? s.mine : s.theirs]}>
                {isGroup && !item.mine ? <Text style={s.sender}>{item.sender_name}</Text> : null}
                <Text style={[s.body, item.mine && { color: '#fff' }]}>{item.body}</Text>
                <Text style={[s.time, item.mine && { color: 'rgba(255,255,255,0.75)' }]}>
                  {fmtDateTime(item.sent_at)}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errorText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.danger, textAlign: 'center' },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textMuted, marginTop: 4 },
  list: { padding: spacing.md, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginVertical: 3 },
  mineRow: { justifyContent: 'flex-end' },
  theirsRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  mine: { backgroundColor: '#1E88E5', borderBottomRightRadius: 4 },
  theirs: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  sender: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs, color: '#1E88E5', marginBottom: 2 },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.md, color: COLORS.text },
  time: { fontFamily: fontFamily.regular, fontSize: 10, color: COLORS.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 21,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E88E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
