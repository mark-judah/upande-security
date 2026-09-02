import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Segmented } from '@/src/core/ui/Segmented';
import { Dropdown } from '@/src/core/ui/Dropdown';
import { Input } from '@/src/core/ui/Input';
import { Button } from '@/src/core/ui/Button';
import { useSupplierBadges } from '@/lib/hooks/useSupplierBadges';
import { useUpdateSupplierBadge } from '@/lib/hooks/useUpdateSupplierBadge';
import { fmtDateTime } from '@/lib/utils/date';
import type { SupplierBadgeRow, SupplierBadgeStatus } from '@/lib/services/api';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// Tapping a badge opens an inline issue/edit form via update_supplier_badge
// — the same verb both issues a badge (supplier + company +
// status="Active" on a currently "Unassigned" badge, one call) and edits
// an already-assigned one. Supplier/Company are plain text inputs for now:
// there's no search-as-you-type verb for Supplier yet (unlike Employee's
// search_employees), and building one is out of scope here — see the
// mobile-rn task notes.

type FilterValue = 'Unassigned' | 'Active' | 'Suspended' | 'Lost' | '';

const FILTER_OPTS: { value: FilterValue; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'Unassigned', label: 'Unassigned' },
  { value: 'Active', label: 'Active' },
  { value: 'Suspended', label: 'Suspended' },
  { value: 'Lost', label: 'Lost' },
];

const STATUS_OPTS: { value: SupplierBadgeStatus; label: string }[] = [
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
  const [expanded, setExpanded] = useState(false);

  const [supplier, setSupplier] = useState(item.supplier || '');
  const [company, setCompany] = useState(item.company || '');
  const [status, setStatus] = useState<SupplierBadgeStatus>(
    (item.status as SupplierBadgeStatus) || 'Unassigned',
  );

  const updateBadge = useUpdateSupplierBadge();
  const isUnassigned = item.status === 'Unassigned';

  useEffect(() => {
    if (!expanded) return;
    setSupplier(item.supplier || '');
    setCompany(item.company || '');
    setStatus((item.status as SupplierBadgeStatus) || 'Unassigned');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, item.name]);

  const onSave = async () => {
    try {
      await updateBadge.mutateAsync({
        name: item.name,
        supplier: supplier.trim() || undefined,
        company: company.trim() || undefined,
        status,
      });
      setExpanded(false);
    } catch (e) {
      Alert.alert('Could not save badge', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <View style={s.card}>
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <View style={s.cardHeaderRow}>
          <Ionicons name="id-card-outline" size={18} color={COLORS.textMuted} />
          <Text style={s.badgeNumber} numberOfLines={1}>#{item.badge_number}</Text>
          <View style={[s.pill, { backgroundColor: tint.backgroundColor }]}>
            <Text style={[s.pillText, { color: tint.color }]}>{item.status || 'Unassigned'}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.textMuted}
          />
        </View>
        <Text style={s.supplierName} numberOfLines={1}>{item.supplier_name || item.supplier || 'No supplier assigned'}</Text>
        {item.creation ? <Text style={s.meta}>{fmtDateTime(item.creation)}</Text> : null}
      </Pressable>

      {expanded ? (
        <View style={s.editForm}>
          <View style={s.divider} />

          {isUnassigned ? (
            <Text style={s.issueHint}>
              This badge is unassigned — set a supplier, company, and Active status to issue it.
            </Text>
          ) : null}

          <Input
            label="Supplier"
            value={supplier}
            onChangeText={setSupplier}
            placeholder="Supplier name or ID"
            autoCapitalize="none"
          />
          <Input
            label="Company"
            value={company}
            onChangeText={setCompany}
            placeholder="Company name or ID"
            autoCapitalize="none"
          />
          <Dropdown
            label="Status"
            value={status}
            options={STATUS_OPTS.map((o) => ({ label: o.label, value: o.value }))}
            searchable={false}
            onChange={(v) => setStatus(v as SupplierBadgeStatus)}
          />

          <View style={s.actionRow}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setExpanded(false)}
              disabled={updateBadge.isPending}
              style={{ flex: 1 }}
            />
            <Button
              label={isUnassigned ? 'Issue badge' : 'Save'}
              loading={updateBadge.isPending}
              disabled={updateBadge.isPending}
              onPress={onSave}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}
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

  editForm: { marginTop: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginBottom: spacing.md },
  issueHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
