import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { useConversations } from '@/lib/hooks/useMessages';
import { fmtDateTime } from '@/lib/utils/date';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// Security messages: every conversation the user is in, newest first, with
// what is unread. Tapping one opens it; New message starts one.

export default function MessagesScreen() {
  const { data, isLoading, error, refetch } = useConversations();
  const list = data ?? [];

  return (
    <Screen
      title="Messages"
      onRefresh={async () => {
        await refetch();
      }}
      loading={isLoading && !data}
      error={!isLoading && error ? (error instanceof Error ? error.message : 'Failed to load') : null}
      onRetry={() => refetch()}
      footer={<Button label="NEW MESSAGE" iconLeft="create-outline" onPress={() => router.push('/message-new')} />}
    >
      {list.length === 0 && !isLoading ? (
        <View style={s.empty}>
          <Ionicons name="chatbubbles-outline" size={56} color={COLORS.border} />
          <Text style={s.emptyTitle}>No messages yet</Text>
          <Text style={s.emptyHint}>Message a supervisor or another guard with the button below.</Text>
        </View>
      ) : null}

      {list.map((c) => (
        <Pressable
          key={c.name}
          onPress={() => router.push({ pathname: '/message-thread', params: { conversation: c.name } })}
          style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
        >
          <View style={s.avatar}>
            <Ionicons name={c.type === 'Group' ? 'people' : 'person'} size={20} color={COLORS.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.titleRow}>
              <Text style={[s.title, c.unread ? s.bold : null]} numberOfLines={1}>
                {c.title}
              </Text>
              <Text style={s.time}>{c.last_message_at ? fmtDateTime(c.last_message_at) : ''}</Text>
            </View>
            <View style={s.titleRow}>
              <Text style={[s.preview, c.unread ? s.previewUnread : null]} numberOfLines={1}>
                {c.last_message || (c.type === 'Group' ? `${c.members} members` : '')}
              </Text>
              {c.unread ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{c.unread > 99 ? '99+' : c.unread}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.lg },
  emptyTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.textMuted, marginTop: spacing.md },
  emptyHint: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.md, color: COLORS.text },
  bold: { fontFamily: fontFamily.bold },
  time: { fontFamily: fontFamily.regular, fontSize: 11, color: COLORS.textMuted },
  preview: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textMuted, marginTop: 2 },
  previewUnread: { color: COLORS.text },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#1E88E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontFamily: fontFamily.bold, fontSize: 11 },
});
