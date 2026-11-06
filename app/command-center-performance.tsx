import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { useGuardRanking } from '@/lib/hooks/useGuardRanking';
import type { GuardRankingFarm, GuardRankingHalf, GuardRankingPeriod, GuardRankingRow } from '@/lib/services/api';
import { fmtDateTime } from '@/lib/utils/date';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// Command Center - Guard performance: the Security Dashboard's guard ranking
// (patrol coverage, distance, checkpoint scans and incidents on shift, each
// against the best guard on the same farm). Periods follow the security day
// (06:00 to 06:00 unless Security Ops Settings says otherwise).

const PERIODS: { value: GuardRankingPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
];

const HALVES: { value: GuardRankingHalf; label: string }[] = [
  { value: 'all', label: 'All day' },
  { value: 'day', label: 'Day 06–18' },
  { value: 'night', label: 'Night 18–06' },
];

const GREEN = '#3B6D11';
const RED = '#A32D2D';

function fmtHa(x: number | null | undefined): string {
  if (x === null || x === undefined) return '—';
  return `${x >= 100 ? Math.round(x) : x.toFixed(x >= 10 ? 1 : 2)} ha`;
}

function fmtHours(h: number): string {
  const m = Math.round((h || 0) * 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function FarmHeader({ f }: { f: GuardRankingFarm }) {
  const gap = f.covered_ha !== null && f.area_ha !== null ? Math.max(0, f.area_ha - f.covered_ha) : null;
  const pct = Math.min(100, f.coverage_pct ?? 0);
  return (
    <View style={s.farmHead}>
      <View style={s.farmTitleRow}>
        <Text style={s.farmName} numberOfLines={1}>{f.farm}</Text>
        <Text style={s.farmMeta}>
          {f.guards} {f.guards === 1 ? 'guard' : 'guards'} · {f.distance_km.toFixed(1)} km · {fmtHours(f.patrol_hours)}
        </Text>
      </View>
      {f.covered_ha !== null ? (
        <>
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={s.farmArea}>
            <Text style={{ color: GREEN, fontFamily: fontFamily.semiBold }}>{fmtHa(f.covered_ha)} patrolled</Text>
            {' '}({f.coverage_pct}%) ·{' '}
            <Text style={{ color: RED, fontFamily: fontFamily.semiBold }}>{fmtHa(gap)} not</Text> · farm {fmtHa(f.area_ha)}
          </Text>
        </>
      ) : (
        <Text style={s.farmArea}>No boundary on this farm - area not measured</Text>
      )}
    </View>
  );
}

function GuardRow({
  r,
  checkpoints,
  window,
}: {
  r: GuardRankingRow;
  checkpoints: boolean;
  window: { start?: string; end?: string };
}) {
  const top = r.rank <= 3;
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((v) => !v)} style={s.guardRow}>
      <View style={[s.rank, top && s.rankTop]}>
        <Text style={[s.rankText, top && s.rankTextTop]}>{r.rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.guardTitleRow}>
          <Text style={s.guardName} numberOfLines={1}>{r.name || r.guard}</Text>
          <Text style={s.score}>{r.score.toFixed(1)}</Text>
        </View>
        <View style={s.scoreBar}>
          <View style={[s.scoreFill, { width: `${Math.max(0, Math.min(100, r.score))}%` }]} />
        </View>
        <Text style={s.guardMeta}>
          {r.distance_km.toFixed(2)} km · {fmtHa(r.area_ha)}
          {r.coverage_pct !== null ? ` (${r.coverage_pct.toFixed(1)}%)` : ''} · {fmtHours(r.patrol_hours)} ·{' '}
          {r.patrols} {r.patrols === 1 ? 'patrol' : 'patrols'}
          {checkpoints ? ` · ${r.valid_scans} scans` : ''}
        </Text>
        {r.incidents_scored ? (
          <Text style={[s.guardMeta, { color: RED }]}>
            {r.incidents_scored} incident{r.incidents_scored === 1 ? '' : 's'} on shift
            {r.incidents_serious ? ` (${r.incidents_serious} serious)` : ''}
          </Text>
        ) : null}
        {open ? (
          <View style={s.detail}>
            <Text style={s.detailLine}>
              {r.shifts} shift{r.shifts === 1 ? '' : 's'} · {r.points ?? 0} GPS points
              {checkpoints ? ` · ${r.valid_scans} valid of ${r.scans} scans` : ''}
            </Text>
            {r.first_at ? (
              <Text style={s.detailLine}>
                First fix {fmtDateTime(r.first_at)} · last {r.last_at ? fmtDateTime(r.last_at) : '—'}
              </Text>
            ) : null}
            {(r.incident_list ?? []).length ? (
              <View style={{ marginTop: 6 }}>
                <Text style={s.detailHead}>Incidents on their shifts</Text>
                {(r.incident_list ?? []).map((i) => (
                  <Text key={i.name} style={s.detailLine}>
                    {fmtDateTime(i.at)} · {i.nature}
                    {i.severity ? ` (${i.severity})` : ''}
                    {i.scored ? '' : ' · not scored'}
                  </Text>
                ))}
              </View>
            ) : null}
            {window.start && window.end && r.points ? (
              <Pressable
                style={s.replay}
                onPress={() =>
                  router.push({
                    pathname: '/command-center-patrol-map',
                    params: { mode: 'playback', farm: r.farm, guard: r.guard, from: window.start, to: window.end },
                  })
                }
              >
                <Ionicons name="play-circle-outline" size={16} color="#1E88E5" />
                <Text style={s.replayText}>Replay patrol</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} style={{ marginTop: 4 }} />
    </Pressable>
  );
}

export default function GuardPerformanceScreen() {
  const [period, setPeriod] = useState<GuardRankingPeriod>('yesterday');
  const [half, setHalf] = useState<GuardRankingHalf>('all');
  const [farm, setFarm] = useState<string>('');
  const { data, isLoading, isFetching, error, refetch } = useGuardRanking(period, half);

  const byFarm = useMemo(() => {
    const out: Record<string, GuardRankingRow[]> = {};
    for (const r of data?.rows ?? []) (out[r.farm] = out[r.farm] || []).push(r);
    return out;
  }, [data]);
  const farms = (data?.farms ?? []).filter((f) => !farm || f.farm === farm);

  return (
    <Screen
      title="Guard performance"
      onRefresh={async () => {
        await refetch();
      }}
      loading={isLoading && !data}
      error={!isLoading && error ? (error instanceof Error ? error.message : 'Failed to load') : null}
      onRetry={() => refetch()}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {PERIODS.map((p) => (
          <Chip key={p.value} label={p.label} active={p.value === period} onPress={() => setPeriod(p.value)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {HALVES.map((h) => (
          <Chip key={h.value} label={h.label} active={h.value === half} onPress={() => setHalf(h.value)} />
        ))}
      </ScrollView>
      {data?.farms && data.farms.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          <Chip label="All farms" active={!farm} onPress={() => setFarm('')} />
          {data.farms.map((f) => (
            <Chip key={f.farm} label={f.farm} active={farm === f.farm} onPress={() => setFarm(f.farm)} />
          ))}
        </ScrollView>
      ) : null}
      <Text style={s.window}>
        {data?.window_label || (data ? `${data.from_date} to ${data.to_date}` : '')}
        {isFetching && data ? ' · refreshing…' : ''}
      </Text>

      {farms.length === 0 && !isLoading ? (
        <View style={s.empty}>
          <Ionicons name="walk-outline" size={48} color={COLORS.border} />
          <Text style={s.emptyTitle}>No patrols in this period</Text>
        </View>
      ) : null}

      {farms.map((f) => (
        <View key={f.farm} style={s.card}>
          <FarmHeader f={f} />
          {(byFarm[f.farm] ?? []).map((r) => (
            <GuardRow key={r.guard} r={r} checkpoints={!!data?.checkpoints} window={{ start: data?.start, end: data?.end }} />
          ))}
        </View>
      ))}

      {data ? (
        <Text style={s.footnote}>
          Score (0-100): patrol coverage, distance, valid checkpoint scans and safety (incidents on shift), each
          against the best guard on the same farm. Area patrolled counts the farm squares any guard&apos;s track
          entered, once each. Tap a guard for their shifts, incidents and a replay of their patrol.
        </Text>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  chipRow: { gap: spacing.xs, paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  chipText: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.bg },
  window: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginBottom: spacing.md },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  farmHead: { marginBottom: spacing.sm },
  farmTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  farmName: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: fontSize.md, color: COLORS.text },
  farmMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted },
  bar: { height: 8, borderRadius: 4, backgroundColor: '#F0D6D6', overflow: 'hidden', marginTop: spacing.sm },
  barFill: { height: 8, borderRadius: 4, backgroundColor: GREEN },
  farmArea: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 4 },
  guardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rankTop: { backgroundColor: '#EEEDFE' },
  rankText: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: COLORS.textMuted },
  rankTextTop: { color: '#3C3489' },
  guardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  guardName: { flex: 1, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text },
  score: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: COLORS.text },
  scoreBar: { height: 4, borderRadius: 2, backgroundColor: COLORS.bgMuted, overflow: 'hidden', marginTop: 4 },
  scoreFill: { height: 4, borderRadius: 2, backgroundColor: COLORS.text },
  guardMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { color: COLORS.textMuted, marginTop: spacing.sm, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold },
  detail: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  detailHead: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs, color: COLORS.text, marginBottom: 2 },
  detailLine: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textSecondary, marginTop: 2 },
  replay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#1E88E5',
  },
  replayText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs, color: '#1E88E5' },
  footnote: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
