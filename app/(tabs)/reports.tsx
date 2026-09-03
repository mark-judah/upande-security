import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Segmented } from '@/src/core/ui/Segmented';
import { Dropdown } from '@/src/core/ui/Dropdown';
import { IncidentCard } from '@/components/reports/IncidentCard';
import { PatrolMap, type PatrolMapHandle } from '@/components/reports/PatrolMap';
import { useSecurityReport } from '@/lib/hooks/useSecurityReport';
import type {
  ReportTab,
  ReportTable as ReportTableT,
  ReportWatch as ReportWatchT,
  ReportKpi,
} from '@/lib/services/api';
import { COLORS, borderRadius, fontFamily, fontSize, shadow, spacing } from '@/src/core/theme';

const TABS: { value: ReportTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'visitors', label: 'Visitors' },
  { value: 'contractors', label: 'Contractors' },
  { value: 'staff', label: 'Staff' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'incidents', label: 'Incidents' },
  { value: 'patrols', label: 'Patrols' },
];

type RangePreset = 'today' | '7d' | '30d';
const RANGE_OPTS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeRange(preset: RangePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === '7d') from.setDate(from.getDate() - 6);
  else if (preset === '30d') from.setDate(from.getDate() - 29);
  return { from: ymd(from), to: ymd(to) };
}

const TONE_COLOR: Record<ReportWatchT['tone'], string> = {
  danger: COLORS.danger,
  warn: COLORS.warn,
  ok: COLORS.success,
};

function KpiGrid({ kpis }: { kpis: ReportKpi[] }) {
  if (!kpis.length) return null;
  return (
    <View style={s.kpiGrid}>
      {kpis.map((k, i) => (
        <View key={i} style={s.kpiCard}>
          <Text style={s.kpiValue} numberOfLines={1}>
            {String(k.value)}
          </Text>
          <Text style={s.kpiLabel}>{k.label}</Text>
          {k.sub ? <Text style={s.kpiSub}>{k.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function ReportTable({
  table,
  onRowPress,
}: {
  table: ReportTableT;
  // Optional — only the patrols tab's "By Guard" table uses this, to zoom
  // the map to that guard's points on tap. Every other table stays plain.
  onRowPress?: (row: ReportTableT['rows'][number]) => void;
}) {
  return (
    <View style={s.block}>
      <Text style={s.blockTitle}>{table.title}</Text>
      <View style={s.table}>
        <View style={[s.row, s.headRow]}>
          {table.columns.map((c) => (
            <Text
              key={c.key}
              style={[s.headCell, c.align === 'right' && s.alignRight]}
              numberOfLines={1}
            >
              {c.label}
            </Text>
          ))}
        </View>
        {table.rows.length === 0 ? (
          <Text style={s.emptyRow}>No data in range</Text>
        ) : (
          table.rows.map((r, ri) => {
            const cells = table.columns.map((c) => (
              <Text
                key={c.key}
                style={[s.cell, c.align === 'right' && s.alignRight]}
                numberOfLines={1}
              >
                {r[c.key] === undefined || r[c.key] === null ? '—' : String(r[c.key])}
              </Text>
            ));
            if (!onRowPress) {
              return (
                <View key={ri} style={[s.row, ri % 2 === 1 && s.rowAlt]}>
                  {cells}
                </View>
              );
            }
            return (
              <TouchableOpacity
                key={ri}
                activeOpacity={0.6}
                onPress={() => onRowPress(r)}
                style={[s.row, ri % 2 === 1 && s.rowAlt]}
              >
                {cells}
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </View>
  );
}

function WatchList({ watch }: { watch: ReportWatchT }) {
  const color = TONE_COLOR[watch.tone] ?? COLORS.textMuted;
  return (
    <View style={s.block}>
      <View style={s.watchHead}>
        <Ionicons name="alert-circle" size={16} color={color} />
        <Text style={[s.watchTitle, { color }]}>{watch.title}</Text>
        <View style={[s.watchBadge, { backgroundColor: color }]}>
          <Text style={s.watchBadgeText}>{watch.rows.length}</Text>
        </View>
      </View>
      {watch.rows.length === 0 ? (
        <Text style={s.allClear}>All clear</Text>
      ) : (
        <View style={[s.watchBox, { borderLeftColor: color }]}>
          {watch.rows.map((row, i) => (
            <View key={i} style={s.watchRow}>
              <Text style={s.watchLabel} numberOfLines={1}>
                {row.label}
              </Text>
              <Text style={s.watchDetail} numberOfLines={1}>
                {row.detail}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ReportsTab() {
  const [tab, setTab] = useState<ReportTab>('overview');
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [farm, setFarm] = useState('');
  const [location, setLocation] = useState('');
  // While a finger is down on the patrol map, yield vertical gestures to
  // Leaflet's own pan handling instead of letting the outer Screen ScrollView
  // claim them — otherwise only horizontal drags reach the map.
  const [mapTouched, setMapTouched] = useState(false);
  const patrolMapRef = useRef<PatrolMapHandle>(null);
  const { from, to } = useMemo(() => computeRange(preset), [preset]);

  const isAppt = tab === 'visitors' || tab === 'contractors';
  const filters = {
    farm: isAppt ? farm : undefined,
    location: tab === 'incidents' ? location : undefined,
  };
  const { data, isLoading, error, refetch, isFetching } = useSecurityReport(tab, from, to, filters);

  function onTab(next: ReportTab) {
    setTab(next);
    setFarm('');
    setLocation('');
  }

  return (
    <Screen
      title="Reports"
      onRefresh={async () => { await refetch(); }}
      scrollEnabled={!mapTouched}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillBar}
      >
        {TABS.map((t) => {
          const active = t.value === tab;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => onTab(t.value)}
              activeOpacity={0.8}
              style={[s.pill, active && s.pillActive]}
            >
              <Text style={[s.pillText, active && s.pillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Segmented value={preset} options={RANGE_OPTS} onChange={setPreset} />

      {isAppt && data?.farms?.length ? (
        <Dropdown
          label=""
          value={farm}
          placeholder="All farms"
          iconName="tractor"
          onChange={setFarm}
          options={[{ label: 'All farms', value: '' }, ...data.farms.map((f) => ({ label: f, value: f }))]}
        />
      ) : null}
      {tab === 'incidents' && data?.locations?.length ? (
        <Dropdown
          label=""
          value={location}
          placeholder="All locations"
          iconName="map-marker-outline"
          onChange={setLocation}
          options={[{ label: 'All locations', value: '' }, ...data.locations.map((l) => ({ label: l, value: l }))]}
        />
      ) : null}

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.text} />
        </View>
      ) : error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>
            {error instanceof Error ? error.message : 'Failed to load report'}
          </Text>
        </View>
      ) : data ? (
        <View style={{ opacity: isFetching ? 0.6 : 1 }}>
          <KpiGrid kpis={data.kpis} />
          {tab === 'patrols' && data.points ? (
            <View
              onTouchStart={() => setMapTouched(true)}
              onTouchEnd={() => setMapTouched(false)}
              onTouchCancel={() => setMapTouched(false)}
            >
              <PatrolMap ref={patrolMapRef} points={data.points} />
            </View>
          ) : null}
          {data.tables.map((t, i) => (
            <ReportTable
              key={i}
              table={t}
              onRowPress={
                tab === 'patrols' && t.title === 'By Guard'
                  ? (row) => {
                      const guard = row.guard;
                      if (typeof guard === 'string' && guard && guard !== '—') {
                        patrolMapRef.current?.zoomToGuard(guard);
                      }
                    }
                  : undefined
              }
            />
          ))}
          {data.watch.map((w, i) => (
            <WatchList key={i} watch={w} />
          ))}
          {tab === 'incidents' && data.details && data.details.length > 0 ? (
            <View style={s.block}>
              <Text style={s.blockTitle}>Incident Details ({data.details.length})</Text>
              {data.details.map((d) => (
                <IncidentCard key={d.name} incident={d} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  pillBar: { gap: spacing.sm, paddingBottom: spacing.md, paddingRight: spacing.md },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  pillActive: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  pillText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.textMuted },
  pillTextActive: { color: COLORS.textOnPrimary },

  center: { paddingVertical: 48, alignItems: 'center' },
  errorBox: { backgroundColor: COLORS.surface, padding: spacing.md, borderRadius: borderRadius.md },
  errorText: { color: COLORS.danger, fontSize: fontSize.sm, fontFamily: fontFamily.regular },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  kpiCard: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    ...shadow.sm,
  },
  kpiValue: { fontSize: 26, fontFamily: fontFamily.bold, color: COLORS.text },
  kpiLabel: { fontSize: fontSize.sm, color: COLORS.text, fontFamily: fontFamily.medium, marginTop: 2 },
  kpiSub: { fontSize: fontSize.xs, color: COLORS.textMuted, fontFamily: fontFamily.regular, marginTop: 1 },

  block: { marginBottom: spacing.lg },
  blockTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    color: COLORS.textSecondary,
    marginBottom: spacing.sm,
  },
  table: {
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  headRow: { backgroundColor: COLORS.surfaceAlt },
  rowAlt: { backgroundColor: COLORS.bgMuted },
  headCell: { flex: 1, fontFamily: fontFamily.semiBold, fontSize: fontSize.xs, color: COLORS.textSecondary },
  cell: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.text },
  alignRight: { textAlign: 'right' },
  emptyRow: { padding: spacing.md, color: COLORS.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm },

  watchHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: 6 },
  watchTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, flex: 1 },
  watchBadge: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 1, borderRadius: borderRadius.full, alignItems: 'center' },
  watchBadgeText: { color: COLORS.textOnPrimary, fontFamily: fontFamily.bold, fontSize: fontSize.xs },
  allClear: { color: COLORS.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  watchBox: {
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  watchRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.bgMuted,
  },
  watchLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text },
  watchDetail: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 1 },
});
