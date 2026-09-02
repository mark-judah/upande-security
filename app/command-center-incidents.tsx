import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIncidents } from '@/lib/hooks/useIncidents';
import { useUpdateIncident } from '@/lib/hooks/useUpdateIncident';
import { fmtDateTime } from '@/lib/utils/date';
import type { IncidentSeverity } from '@/lib/api/types';
import type { IncidentSummary } from '@/lib/services/api';
import { Screen } from '@/src/core/ui/Screen';
import { Dropdown } from '@/src/core/ui/Dropdown';
import { Input } from '@/src/core/ui/Input';
import { Button } from '@/src/core/ui/Button';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// Full incident list for Command Center — same list_incidents verb as the
// guard-facing Incidents tab, but server-side access-scoped broader
// (System Manager sees all, Security Head their permission scope). Tapping
// a card opens an inline review form (status transition + resolution /
// corrective-action notes) via update_incident — separate from the initial
// filing flow (create_incident on the guard-facing side).

type Range = 'today' | '7d' | '30d' | 'all';

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

type IncidentStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

const STATUS_OPTS: { value: IncidentStatus; label: string }[] = [
  { value: 'Open', label: 'Open' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' },
];

function severityStyle(level: IncidentSeverity | string): { bg: string; fg: string } {
  switch (level) {
    case 'Critical':
      return { bg: COLORS.text, fg: COLORS.bg };
    case 'High':
      return { bg: '#333333', fg: COLORS.bg };
    case 'Medium':
      return { bg: COLORS.bgMuted, fg: COLORS.text };
    case 'Low':
    default:
      return { bg: '#F5F5F5', fg: COLORS.textSecondary };
  }
}

function statusStyle(status: string): { bg: string; fg: string } {
  const s = status.toLowerCase();
  if (s.includes('resolved') || s.includes('closed')) {
    return { bg: 'rgba(34,197,94,0.12)', fg: '#166534' };
  }
  if (s.includes('progress') || s.includes('review')) {
    return { bg: 'rgba(30,136,229,0.12)', fg: '#1E88E5' };
  }
  return { bg: 'rgba(245,158,11,0.14)', fg: '#92400E' }; // Open / default
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeBounds(r: Range): { from?: string; to?: string } {
  if (r === 'all') return {};
  const today = new Date();
  const to = toIsoDate(today);
  if (r === 'today') return { from: to, to };
  const days = r === '7d' ? 6 : 29;
  const from = new Date(today);
  from.setDate(today.getDate() - days);
  return { from: toIsoDate(from), to };
}

function IncidentCard({ inc }: { inc: IncidentSummary }) {
  const sev = severityStyle(inc.severity as IncidentSeverity);
  const st = statusStyle(inc.status);
  const [expanded, setExpanded] = useState(false);

  // The list verb (list_incidents) doesn't return resolution/
  // corrective_actions — only the review form ever writes them, so there's
  // nothing to pre-fill from this row; the form always opens blank and
  // just submits whatever the reviewer enters this time.
  const [status, setStatus] = useState<IncidentStatus>((inc.status as IncidentStatus) || 'Open');
  const [resolution, setResolution] = useState('');
  const [correctiveActions, setCorrectiveActions] = useState('');

  const updateIncident = useUpdateIncident();

  useEffect(() => {
    if (expanded) setStatus((inc.status as IncidentStatus) || 'Open');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, inc.name]);

  const onSave = async () => {
    try {
      await updateIncident.mutateAsync({
        name: inc.name,
        status,
        resolution: resolution.trim() || undefined,
        corrective_actions: correctiveActions.trim() || undefined,
      });
      setExpanded(false);
    } catch (e) {
      Alert.alert('Could not save incident', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <View style={s.card}>
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{inc.nature_of_incident}</Text>
            <Text style={s.cardLocation} numberOfLines={1}>{inc.location}</Text>
          </View>
          <View style={s.pillCol}>
            <View style={[s.pill, { backgroundColor: sev.bg }]}>
              <Text style={[s.pillText, { color: sev.fg }]}>{inc.severity.toUpperCase()}</Text>
            </View>
            <View style={[s.pill, { backgroundColor: st.bg, marginTop: 4 }]}>
              <Text style={[s.pillText, { color: st.fg }]}>{inc.status || 'Open'}</Text>
            </View>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.textMuted}
            style={{ marginLeft: spacing.sm, marginTop: 2 }}
          />
        </View>
        <Text style={s.cardBody} numberOfLines={3}>{inc.description}</Text>
        <View style={s.cardFooter}>
          <Text style={s.cardMeta} numberOfLines={1}>{inc.reported_by || inc.name}</Text>
          <Text style={s.cardMeta}>{fmtDateTime(inc.incident_datetime)}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={s.reviewForm}>
          <View style={s.divider} />

          <Dropdown
            label="Status"
            value={status}
            options={STATUS_OPTS.map((o) => ({ label: o.label, value: o.value }))}
            searchable={false}
            onChange={(v) => setStatus(v as IncidentStatus)}
          />

          <Input
            label="Resolution"
            value={resolution}
            onChangeText={setResolution}
            placeholder="What was done to resolve this?"
            multiline
            numberOfLines={3}
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />

          <Input
            label="Corrective actions"
            value={correctiveActions}
            onChangeText={setCorrectiveActions}
            placeholder="Steps taken to prevent recurrence"
            multiline
            numberOfLines={3}
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />

          <View style={s.actionRow}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setExpanded(false)}
              disabled={updateIncident.isPending}
              style={{ flex: 1 }}
            />
            <Button
              label="Save"
              loading={updateIncident.isPending}
              disabled={updateIncident.isPending}
              onPress={onSave}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function CommandCenterIncidentsScreen() {
  const [range, setRange] = useState<Range>('7d');
  const filter = useMemo(() => rangeBounds(range), [range]);
  const { data, isLoading, isFetching, error, refetch } = useIncidents(filter);

  return (
    <Screen
      title="Incidents"
      onRefresh={async () => { await refetch(); }}
      error={!isLoading && error ? (error instanceof Error ? error.message : 'Failed to load') : null}
      onRetry={() => refetch()}
    >
      <View style={s.filterRow}>
        {RANGE_OPTIONS.map((opt) => {
          const active = opt.key === range;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setRange(opt.key)}
              style={[s.chip, active && s.chipActive]}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {data && data.length > 0 ? (
        data.map((inc) => <IncidentCard key={inc.name} inc={inc} />)
      ) : (
        <View style={s.emptyState}>
          <Ionicons name="file-tray-outline" size={48} color={COLORS.border} />
          <Text style={s.emptyTitle}>
            {isLoading || isFetching ? 'Loading…' : 'No incidents in this range'}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
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
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.md,
    padding: 14,
    marginBottom: spacing.sm + 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  cardTitle: { fontFamily: fontFamily.bold, color: COLORS.text, fontSize: fontSize.sm },
  cardLocation: { color: COLORS.textMuted, fontSize: fontSize.xs, marginTop: 2, fontFamily: fontFamily.regular },
  pillCol: { alignItems: 'flex-end', marginLeft: spacing.sm },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  pillText: { fontSize: 10, fontFamily: fontFamily.bold, letterSpacing: 0.5 },
  cardBody: { color: COLORS.textSecondary, fontSize: fontSize.xs, fontFamily: fontFamily.regular },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  cardMeta: { color: COLORS.textMuted, fontSize: 11, fontFamily: fontFamily.regular },
  emptyState: { alignItems: 'center', padding: spacing.xxl + spacing.lg },
  emptyTitle: { color: COLORS.textMuted, marginTop: spacing.sm + 2, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold },

  reviewForm: { marginTop: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginBottom: spacing.md },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
