import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useIncidents } from '@/lib/hooks/useIncidents';
import { fmtDateTime } from '@/lib/utils/date';
import type { IncidentSeverity } from '@/lib/api/types';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Range = 'today' | '7d' | '30d' | 'all';

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

function severityStyle(level: IncidentSeverity): { bg: string; fg: string } {
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

function toIsoDate(d: Date): string {
  // Local-time YYYY-MM-DD — server uses DATE(incident_datetime) for the bound,
  // which evaluates in the site's timezone. Off-by-one risk is low because the
  // gate user and the Frappe site are in the same timezone.
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
  const days = r === '7d' ? 6 : 29; // inclusive: "Last 7 days" = today + 6 prior
  const from = new Date(today);
  from.setDate(today.getDate() - days);
  return { from: toIsoDate(from), to };
}

export default function IncidentsList() {
  const [range, setRange] = useState<Range>('7d');
  const filter = useMemo(() => rangeBounds(range), [range]);
  const { data, isLoading, isFetching, refetch } = useIncidents(filter);

  return (
    <Screen
      title="Incidents"
      onRefresh={async () => {
        await refetch();
      }}
      footer={
        <Button
          label="REPORT INCIDENT"
          iconLeft="warning"
          onPress={() => router.push('/incident-new')}
        />
      }
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
        data.map((inc) => {
          const sev = severityStyle(inc.severity as IncidentSeverity);
          return (
            <View key={inc.name} style={s.card}>
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{inc.nature_of_incident}</Text>
                  <Text style={s.cardLocation} numberOfLines={1}>
                    {inc.location}
                  </Text>
                </View>
                <View style={[s.severityPill, { backgroundColor: sev.bg }]}>
                  <Text style={[s.severityText, { color: sev.fg }]}>
                    {inc.severity.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={s.cardBody} numberOfLines={2}>
                {inc.description}
              </Text>
              <View style={s.cardFooter}>
                <Text style={s.cardMeta} numberOfLines={1}>
                  {inc.reported_by || inc.name}
                </Text>
                <Text style={s.cardMeta}>{fmtDateTime(inc.incident_datetime)}</Text>
              </View>
            </View>
          );
        })
      ) : (
        <View style={s.emptyState}>
          <Ionicons name="file-tray-outline" size={48} color={COLORS.border} />
          <Text style={s.emptyTitle}>
            {isLoading || isFetching ? 'Loading…' : 'No incidents in this range'}
          </Text>
          <Text style={s.emptySubtitle}>
            Switch to a wider range, or tap the button below to file one.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  chipText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: COLORS.textSecondary,
  },
  chipTextActive: { color: COLORS.bg },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.md,
    padding: 14,
    marginBottom: spacing.sm + 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: fontFamily.bold,
    color: COLORS.text,
    fontSize: fontSize.sm,
  },
  cardLocation: {
    color: COLORS.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    fontFamily: fontFamily.regular,
  },
  severityPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  severityText: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.5,
  },
  cardBody: {
    color: COLORS.textSecondary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  cardMeta: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: fontFamily.regular,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl + spacing.lg,
  },
  emptyTitle: {
    color: COLORS.textMuted,
    marginTop: spacing.sm + 2,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semiBold,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    textAlign: 'center',
    fontFamily: fontFamily.regular,
  },
});
