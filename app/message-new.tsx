import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { useMessageContacts } from '@/lib/hooks/useMessages';
import { useSessionInfo } from '@/lib/hooks/useSessionInfo';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { api } from '@/lib/services/api';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// Start a message: pick a person (supervisors first, then guards, within
// the user's own company). Supervisors can also message every guard at one
// of their farms at once.

const SUPERVISOR_ROLES = ['Security Head', 'Security Supervisor', 'Security Manager', 'System Manager'];

export default function NewMessageScreen() {
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const { data, isFetching } = useMessageContacts(query.trim());
  const session = useSessionInfo();
  const feedback = useFeedback();
  const isSupervisor = (session.data?.roles ?? []).some((r) => SUPERVISOR_ROLES.includes(r));
  const people = useMemo(() => data ?? [], [data]);
  // The farms of the guards this supervisor can reach.
  const farms = useMemo(
    () => [...new Set(people.filter((p) => p.kind === 'Guard' && p.farm).map((p) => p.farm as string))].sort(),
    [people],
  );

  const openFarm = async (farm: string) => {
    setOpening(farm);
    try {
      const res = await api.messageFarmGuards(farm);
      router.replace({ pathname: '/message-thread', params: { conversation: res.conversation } });
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Could not open the farm group');
    } finally {
      setOpening(null);
    }
  };

  return (
    <Screen title="New message">
      <View style={s.search}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or farm"
          placeholderTextColor={COLORS.textMuted}
          style={s.searchInput}
          autoFocus
        />
        {isFetching ? <ActivityIndicator size="small" color={COLORS.textMuted} /> : null}
      </View>

      {isSupervisor && !query.trim() && farms.length ? (
        <>
          <Text style={s.section}>All guards at a farm</Text>
          <View style={s.farmRow}>
            {farms.map((f) => (
              <Pressable key={f} onPress={() => openFarm(f)} disabled={!!opening} style={s.farmChip}>
                {opening === f ? (
                  <ActivityIndicator size="small" color={COLORS.text} />
                ) : (
                  <>
                    <Ionicons name="people-outline" size={14} color={COLORS.text} />
                    <Text style={s.farmText}>{f}</Text>
                  </>
                )}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text style={s.section}>People</Text>
      {people.length === 0 && !isFetching ? <Text style={s.empty}>Nobody matches</Text> : null}
      {people.map((p) => (
        <Pressable
          key={p.user}
          onPress={() => router.replace({ pathname: '/message-thread', params: { to: p.user, toName: p.name } })}
          style={({ pressed }) => [s.person, pressed && { opacity: 0.7 }]}
        >
          <View style={s.avatar}>
            <Ionicons name={p.kind === 'Supervisor' ? 'shield-checkmark-outline' : 'person-outline'} size={18} color={COLORS.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{p.name}</Text>
            <Text style={s.meta} numberOfLines={1}>
              {p.kind}{p.farm ? ` · ${p.farm}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        </Pressable>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fontFamily.regular, fontSize: fontSize.md, color: COLORS.text },
  section: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  farmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  farmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  farmText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text },
  empty: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textMuted },
  person: {
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text },
  meta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
});
