import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/src/core/ui/Screen';
import { Segmented } from '@/src/core/ui/Segmented';
import { PatrolMap, type PatrolMapHandle } from '@/components/reports/PatrolMap';
import { PlaybackMap } from '@/components/reports/PlaybackMap';
import { useSecurityReport } from '@/lib/hooks/useSecurityReport';
import { api } from '@/lib/services/api';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// Command Center - Patrol Map, the phone's version of the web Patrol Map and
// Patrol Playback, over each farm's boundary:
// - Tracks: every guard's track for today, 7 or 30 days; tap a guard below
//   to zoom to them.
// - Playback: one farm and window, every guard (or one) replayed in time.
// Guard Performance opens Playback straight on a guard (params mode, farm,
// guard, from, to).

type Mode = 'tracks' | 'playback';
type RangePreset = 'today' | '7d' | '30d';
type Window = 'night' | 'yesterday' | 'today';

const MODES: { value: Mode; label: string }[] = [
  { value: 'tracks', label: 'Tracks' },
  { value: 'playback', label: 'Playback' },
];
const RANGE_OPTS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];
const WINDOWS: { value: Window; label: string }[] = [
  { value: 'night', label: 'Last night' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'today', label: 'Today so far' },
];
// The security day starts at 06:00 (Security Ops Settings default).
const DAY_START_H = 6;

const pad = (n: number) => String(n).padStart(2, '0');
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function stamp(d: Date): string {
  return `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
function computeRange(preset: RangePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === '7d') from.setDate(from.getDate() - 6);
  else if (preset === '30d') from.setDate(from.getDate() - 29);
  return { from: ymd(from), to: ymd(to) };
}
/** [from, to] of a playback window, in site time. */
function windowRange(w: Window): { from: string; to: string } {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(DAY_START_H, 0, 0, 0);
  if (now < dayStart) dayStart.setDate(dayStart.getDate() - 1);
  if (w === 'today') return { from: stamp(dayStart), to: stamp(now) };
  const yStart = new Date(dayStart);
  yStart.setDate(yStart.getDate() - 1);
  if (w === 'yesterday') return { from: stamp(yStart), to: stamp(dayStart) };
  const nStart = new Date(yStart);
  nStart.setHours(DAY_START_H + 12);
  return { from: stamp(nStart), to: stamp(dayStart) };
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

export default function PatrolMapScreen() {
  const params = useLocalSearchParams<{ mode?: string; farm?: string; guard?: string; from?: string; to?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'playback' ? 'playback' : 'tracks');
  const [mapTouched, setMapTouched] = useState(false);
  const boundaries = useQuery({
    queryKey: ['farm-boundary-shapes'],
    queryFn: () => api.farmBoundaryShapes(),
    staleTime: 60 * 60 * 1000,
  });

  return (
    <Screen title="Patrol Map" scrollEnabled={!mapTouched}>
      <Segmented value={mode} options={MODES} onChange={setMode} />
      <View style={{ height: spacing.md }} />
      {mode === 'tracks' ? (
        <TracksView boundaries={boundaries.data} setMapTouched={setMapTouched} />
      ) : (
        <PlaybackView
          boundaries={boundaries.data}
          setMapTouched={setMapTouched}
          initial={{ farm: params.farm, guard: params.guard, from: params.from, to: params.to }}
        />
      )}
    </Screen>
  );
}

function TracksView({
  boundaries,
  setMapTouched,
}: {
  boundaries: Parameters<typeof PatrolMap>[0]['boundaries'];
  setMapTouched: (v: boolean) => void;
}) {
  const [preset, setPreset] = useState<RangePreset>('today');
  const [picked, setPicked] = useState<string | null>(null);
  const mapRef = useRef<PatrolMapHandle>(null);
  const { from, to } = useMemo(() => computeRange(preset), [preset]);
  const { data, isLoading, isFetching, error } = useSecurityReport('patrols', from, to, {});
  const guards = data?.tables.find((t) => t.title === 'By Guard')?.rows ?? [];

  return (
    <>
      <Segmented value={preset} options={RANGE_OPTS} onChange={setPreset} />
      <View style={{ height: spacing.md }} />
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.text} />
        </View>
      ) : error ? (
        <Text style={s.error}>{error instanceof Error ? error.message : 'Failed to load the patrol map'}</Text>
      ) : (
        <View style={{ opacity: isFetching ? 0.6 : 1 }}>
          <View
            onTouchStart={() => setMapTouched(true)}
            onTouchEnd={() => setMapTouched(false)}
            onTouchCancel={() => setMapTouched(false)}
          >
            <PatrolMap ref={mapRef} points={data?.points ?? []} boundaries={boundaries} />
          </View>
          <Text style={s.sectionTitle}>Guards · tap one to zoom to their patrol</Text>
          {guards.length === 0 ? <Text style={s.empty}>No patrols in this period</Text> : null}
          {guards.map((g, i) => {
            const name = typeof g.guard === 'string' ? g.guard : String(g.guard ?? '');
            const active = picked === name;
            return (
              <Pressable
                key={`${name}-${i}`}
                onPress={() => {
                  if (!name || name === '—') return;
                  setPicked(name);
                  mapRef.current?.zoomToGuard(name);
                }}
                style={({ pressed }) => [s.guardRow, active && s.guardRowActive, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="walk-outline" size={16} color={active ? COLORS.text : COLORS.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={s.guardName} numberOfLines={1}>{name}</Text>
                  <Text style={s.guardMeta} numberOfLines={1}>
                    {String(g.count ?? 0)} points · {String(g.routes ?? 0)} routes · last seen {String(g.last ?? '—')}
                  </Text>
                </View>
                <Ionicons name="locate-outline" size={16} color={COLORS.textMuted} />
              </Pressable>
            );
          })}
        </View>
      )}
    </>
  );
}

function PlaybackView({
  boundaries,
  setMapTouched,
  initial,
}: {
  boundaries: Parameters<typeof PatrolMap>[0]['boundaries'];
  setMapTouched: (v: boolean) => void;
  initial: { farm?: string; guard?: string; from?: string; to?: string };
}) {
  const farms = useMemo(() => {
    const list = (boundaries ?? []).map((b) => b.farm);
    if (initial.farm && !list.includes(initial.farm)) list.unshift(initial.farm);
    return list;
  }, [boundaries, initial.farm]);
  const [farm, setFarm] = useState<string | undefined>(initial.farm);
  const [win, setWin] = useState<Window | 'custom'>(initial.from && initial.to ? 'custom' : 'night');
  const [guard, setGuard] = useState<string>(initial.guard || '');
  useEffect(() => {
    if (!farm && farms.length) setFarm(farms[0]);
  }, [farm, farms]);

  const range = win === 'custom' ? { from: initial.from as string, to: initial.to as string } : windowRange(win);
  const pb = useQuery({
    queryKey: ['patrol-playback', farm, range.from, range.to],
    queryFn: () => api.patrolPlayback({ farm: farm as string, from_datetime: range.from, to_datetime: range.to }),
    enabled: !!farm,
    staleTime: 5 * 60 * 1000,
  });
  const allGuards = pb.data?.guards ?? [];
  const shown = guard ? allGuards.filter((g) => g.guard === guard) : allGuards;
  const farmShape = (boundaries ?? []).filter((b) => b.farm === farm);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {farms.map((f) => (
          <Chip key={f} label={f} active={f === farm} onPress={() => { setFarm(f); setGuard(''); }} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {win === 'custom' ? <Chip label="From guard performance" active onPress={() => {}} /> : null}
        {WINDOWS.map((w) => (
          <Chip key={w.value} label={w.label} active={win === w.value} onPress={() => setWin(w.value)} />
        ))}
      </ScrollView>

      {pb.isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.text} />
          <Text style={s.empty}>Loading the patrols…</Text>
        </View>
      ) : pb.error ? (
        <Text style={s.error}>{pb.error instanceof Error ? pb.error.message : 'Could not load the playback'}</Text>
      ) : pb.data && pb.data.enabled === false ? (
        <Text style={s.empty}>Patrol playback is turned off in Security Ops Settings.</Text>
      ) : pb.data?.error ? (
        <Text style={s.error}>{pb.data.error}</Text>
      ) : allGuards.length === 0 ? (
        <Text style={s.empty}>No patrol points at {farm} in this window.</Text>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            <Chip label={`All guards (${allGuards.length})`} active={!guard} onPress={() => setGuard('')} />
            {allGuards.map((g) => (
              <Chip key={g.guard} label={g.name} active={guard === g.guard} onPress={() => setGuard(g.guard)} />
            ))}
          </ScrollView>
          <View
            onTouchStart={() => setMapTouched(true)}
            onTouchEnd={() => setMapTouched(false)}
            onTouchCancel={() => setMapTouched(false)}
          >
            <PlaybackMap guards={shown} boundaries={farmShape} from={range.from} to={range.to} />
          </View>
          <Text style={s.footnote}>
            {shown.reduce((n, g) => n + g.points.length, 0)} points
            {pb.data?.thinned_every ? ` · every ${pb.data.thinned_every}th point shown` : ''} · the trail breaks where a
            guard left the farm.
          </Text>
        </>
      )}
    </>
  );
}

const s = StyleSheet.create({
  center: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
  error: { color: COLORS.danger, fontFamily: fontFamily.regular, fontSize: fontSize.sm, paddingVertical: spacing.md },
  empty: {
    color: COLORS.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
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
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  guardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  guardRowActive: { borderColor: COLORS.text, borderWidth: 1 },
  guardName: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text },
  guardMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
  footnote: { fontFamily: fontFamily.regular, fontSize: 11, color: COLORS.textMuted, marginTop: spacing.md, lineHeight: 16 },
});
