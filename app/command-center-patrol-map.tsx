import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Segmented } from '@/src/core/ui/Segmented';
import { PatrolMap, type PatrolMapHandle } from '@/components/reports/PatrolMap';
import { useSecurityReport } from '@/lib/hooks/useSecurityReport';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// Command Center - Patrol Map: every guard's patrol track for the period
// (the security report's patrol points, same rules as the web Patrol Map).
// Tapping a guard below zooms the map to their points. Moved here from
// Reports > Patrols, which keeps the patrol figures.

type RangePreset = 'today' | '7d' | '30d';
const RANGE_OPTS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeRange(preset: RangePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === '7d') from.setDate(from.getDate() - 6);
  else if (preset === '30d') from.setDate(from.getDate() - 29);
  return { from: ymd(from), to: ymd(to) };
}

export default function PatrolMapScreen() {
  const [preset, setPreset] = useState<RangePreset>('today');
  const [picked, setPicked] = useState<string | null>(null);
  // While a finger is on the map, the screen's own scroll lets go so the map
  // gets vertical drags too.
  const [mapTouched, setMapTouched] = useState(false);
  const mapRef = useRef<PatrolMapHandle>(null);
  const { from, to } = useMemo(() => computeRange(preset), [preset]);
  const { data, isLoading, isFetching, error, refetch } = useSecurityReport('patrols', from, to, {});
  const guards = data?.tables.find((t) => t.title === 'By Guard')?.rows ?? [];

  return (
    <Screen
      title="Patrol Map"
      onRefresh={async () => {
        await refetch();
      }}
      scrollEnabled={!mapTouched}
    >
      <Segmented value={preset} options={RANGE_OPTS} onChange={setPreset} />
      <View style={{ height: spacing.md }} />

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.text} />
        </View>
      ) : error ? (
        <Text style={s.error}>{error instanceof Error ? error.message : 'Failed to load the patrol map'}</Text>
      ) : data?.points ? (
        <View style={{ opacity: isFetching ? 0.6 : 1 }}>
          <View
            onTouchStart={() => setMapTouched(true)}
            onTouchEnd={() => setMapTouched(false)}
            onTouchCancel={() => setMapTouched(false)}
          >
            <PatrolMap ref={mapRef} points={data.points} />
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
      ) : (
        <Text style={s.empty}>No patrol points in this period</Text>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  error: { color: COLORS.danger, fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  empty: {
    color: COLORS.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
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
});
