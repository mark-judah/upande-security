import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { Segmented } from '@/src/core/ui/Segmented';
import { useStickerRequestAction, useStickerRequests } from '@/lib/hooks/useStickerRequests';
import { fmtDateTime } from '@/lib/utils/date';
import type { StickerRequestRow } from '@/lib/services/api';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// Reject collects an optional note inline (expand-in-place) rather than via
// a native Alert.prompt — RN's Alert.prompt is iOS-only with no Android
// equivalent, and there's no existing cross-platform prompt-modal
// component elsewhere in this app to reuse, so this deliberately doesn't
// match the literal "prompt" wording in the spec.

type FilterValue = 'Pending' | 'Approved' | 'Rejected' | '';

const FILTER_OPTS: { value: FilterValue; label: string }[] = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

function StickerRequestCard({
  item,
  onApprove,
  onReject,
  busy,
}: {
  item: StickerRequestRow;
  onApprove: (name: string) => void;
  onReject: (name: string, notes: string) => void;
  busy: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [notes, setNotes] = useState('');
  const isPending = item.status === 'Pending';

  return (
    <View style={s.card}>
      <View style={s.cardHeaderRow}>
        <Text style={s.cardName} numberOfLines={1}>{item.employee_name || item.employee}</Text>
        <View style={[s.pill, statusTint(item.status)]}>
          <Text style={[s.pillText, { color: statusTint(item.status).color }]}>{item.status}</Text>
        </View>
      </View>

      <View style={s.detailRow}>
        <Ionicons name="car-outline" size={13} color={COLORS.textMuted} />
        <Text style={s.detailText}>
          {[item.vehicle_type, item.plate_number, item.color].filter(Boolean).join(' · ') || '—'}
        </Text>
      </View>
      {item.collection_point || item.collection_farm ? (
        <View style={s.detailRow}>
          <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
          <Text style={s.detailText}>
            {[item.collection_point, item.collection_farm].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}
      {item.creation ? (
        <View style={s.detailRow}>
          <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
          <Text style={[s.detailText, { color: COLORS.textMuted }]}>{fmtDateTime(item.creation)}</Text>
        </View>
      ) : null}
      {item.review_notes ? (
        <Text style={s.reviewNotes} numberOfLines={3}>Note: {item.review_notes}</Text>
      ) : null}

      {isPending ? (
        rejecting ? (
          <View style={{ marginTop: spacing.md }}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Reason for rejection (optional)"
              placeholderTextColor={COLORS.textMuted}
              style={s.notesInput}
              multiline
            />
            <View style={s.actionRow}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => { setRejecting(false); setNotes(''); }}
                style={{ flex: 1 }}
              />
              <Button
                label="Confirm reject"
                color={COLORS.danger}
                loading={busy}
                disabled={busy}
                onPress={() => onReject(item.name, notes.trim())}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <View style={s.actionRow}>
            <Button
              label="Reject"
              variant="outline"
              color={COLORS.danger}
              disabled={busy}
              onPress={() => setRejecting(true)}
              style={{ flex: 1 }}
            />
            <Button
              label="Approve"
              color={COLORS.success}
              loading={busy}
              disabled={busy}
              onPress={() => onApprove(item.name)}
              style={{ flex: 1 }}
            />
          </View>
        )
      ) : null}
    </View>
  );
}

function statusTint(status: string): { backgroundColor: string; color: string } {
  if (status === 'Approved') return { backgroundColor: 'rgba(34,197,94,0.12)', color: '#166534' };
  if (status === 'Rejected') return { backgroundColor: 'rgba(239,68,68,0.12)', color: COLORS.danger };
  return { backgroundColor: 'rgba(245,158,11,0.14)', color: '#92400E' };
}

export default function CommandCenterStickersScreen() {
  const [filter, setFilter] = useState<FilterValue>('Pending');
  const { data, isLoading, error, refetch } = useStickerRequests({ status: filter });
  const { approve, reject } = useStickerRequestAction();
  const [activeName, setActiveName] = useState<string | null>(null);

  const busyWith = (name: string) => activeName === name && (approve.isPending || reject.isPending);

  const onApprove = (name: string) => {
    Alert.alert('Approve sticker request?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setActiveName(name);
          try { await approve.mutateAsync(name); } finally { setActiveName(null); }
        },
      },
    ]);
  };

  const onReject = async (name: string, notes: string) => {
    setActiveName(name);
    try {
      await reject.mutateAsync({ request_name: name, review_notes: notes || undefined });
    } finally {
      setActiveName(null);
    }
  };

  const items = data ?? [];

  return (
    <Screen
      title="Vehicle Stickers"
      onRefresh={async () => { await refetch(); }}
      error={!isLoading && error ? (error instanceof Error ? error.message : 'Failed to load') : null}
      onRetry={() => refetch()}
    >
      <Segmented value={filter} options={FILTER_OPTS} onChange={setFilter} />
      <View style={{ height: spacing.md }} />

      {!isLoading && items.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="car-outline" size={48} color={COLORS.border} />
          <Text style={s.emptyTitle}>No {filter ? filter.toLowerCase() : ''} requests</Text>
        </View>
      ) : null}

      {items.map((item) => (
        <StickerRequestCard
          key={item.name}
          item={item}
          onApprove={onApprove}
          onReject={onReject}
          busy={busyWith(item.name)}
        />
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  cardName: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.md, color: COLORS.text },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full },
  pillText: { fontSize: 10, fontFamily: fontFamily.bold, letterSpacing: 0.4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  detailText: { fontSize: fontSize.sm, color: COLORS.textSecondary, fontFamily: fontFamily.regular },
  reviewNotes: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: COLORS.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { color: COLORS.textMuted, fontSize: fontSize.md, fontFamily: fontFamily.semiBold, marginTop: spacing.md },
});
