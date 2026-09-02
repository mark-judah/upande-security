import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Segmented } from '@/src/core/ui/Segmented';
import { useSupplierBadges } from '@/lib/hooks/useSupplierBadges';
import { fmtDateTime } from '@/lib/utils/date';
import type { SupplierBadgeRow } from '@/lib/services/api';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// Read-only for v1 — no create/edit mutation endpoint exists yet for
// Supplier Badge from mobile.

type FilterValue = 'Unassigned' | 'Active' | 'Suspended' | 'Lost' | '';

const FILTER_OPTS: { value: FilterValue; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'Unassigned', label: 'Unassigned' },
  { value: 'Active', label: 'Active' },
  { value: 'Suspended', label: 'Suspended' },
  { value: 'Lost', label: 'Lost' },
];

function statusTint(status: string): { backgroundColor: string; color: string } {
  if (status === 'Active') return { backgroundColor: 'rgba(34,197,94,0.12)', color: '#166534' };
  if (status === 'Suspended') return { backgroundColor: 'rgba(245,158,11,0.14)', color: '#92400E' };
  if (status === 'Lost') return { backgroundColor: 'rgba(239,68,68,0.12)', color: COLORS.danger };
  return { backgroundColor: COLORS.bgMuted, color: COLORS.textMuted }; // Unassigned
}

function BadgeCard({ item }: { item: SupplierBadgeRow }) {
  const tint = statusTint(item.status);
  return (
    <View style={s.card}>
      <View style={s.cardHeaderRow}>
        <Ionicons name="id-card-outline" size={18} color={COLORS.textMuted} />
        <Text style={s.badgeNumber} numberOfLines={1}>#{item.badge_number}</Text>
        <View style={[s.pill, { backgroundColor: tint.backgroundColor }]}>
          <Text style={[s.pillText, { color: tint.color }]}>{item.status || 'Unassigned'}</Text>
        </View>
      </View>
      <Text style={s.supplierName} numberOfLines={1}>{item.supplier_name || item.supplier || 'No supplier assigned'}</Text>
      {item.creation ? <Text style={s.meta}>{fmtDateTime(item.creation)}</Text> : null}
    </View>
  );
}

export default function CommandCenterBadgesScreen() {
  const [filter, setFilter] = useState<FilterValue>('');
  const { data, isLoading, error, refetch } = useSupplierBadges({ status: filter });

  const grouped = useMemo(() => {
    const rows = data ?? [];
    const byCompany = new Map<string, SupplierBadgeRow[]>();
    rows.forEach((r) => {
      const key = r.company || 'No company';
      const list = byCompany.get(key) ?? [];
      list.push(r);
      byCompany.set(key, list);
    });
    return Array.from(byCompany.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  return (
    <Screen
      title="Supplier Badges"
      onRefresh={async () => { await refetch(); }}
      error={!isLoading && error ? (error instanceof Error ? error.message : 'Failed to load') : null}
      onRetry={() => refetch()}
    >
      <Segmented value={filter} options={FILTER_OPTS} onChange={setFilter} />
      <View style={{ height: spacing.md }} />

      {!isLoading && grouped.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="id-card-outline" size={48} color={COLORS.border} />
          <Text style={s.emptyTitle}>No badges found</Text>
        </View>
      ) : null}

      {grouped.map(([company, rows]) => (
        <View key={company} style={{ marginBottom: spacing.md }}>
          <Text style={s.companyHeader}>{company} ({rows.length})</Text>
          {rows.map((item) => (
            <BadgeCard key={item.name} item={item} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  companyHeader: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgeNumber: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.md, color: COLORS.text },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  pillText: { fontSize: 10, fontFamily: fontFamily.bold, letterSpacing: 0.4 },
  supplierName: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textSecondary, marginTop: 6 },
  meta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { color: COLORS.textMuted, fontSize: fontSize.md, fontFamily: fontFamily.semiBold, marginTop: spacing.md },
});
