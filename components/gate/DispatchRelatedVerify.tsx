import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  DispatchSearchHitFields,
  GateVerificationStatus,
  VerifyDispatchBulkResult,
} from '@/lib/services/api';
import { fmtDateTime } from '@/lib/utils/date';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  /** related_by_vehicle from the primary scanned document's search result —
   * other open, not-yet-verified dispatch documents sharing this match's
   * vehicle_no. Never includes the primary document itself. */
  items: DispatchSearchHitFields[];
  vehicleNo: string;
  onSubmit: (input: {
    references: string[];
    gate_verification_status: GateVerificationStatus;
    remarks?: string;
  }) => Promise<VerifyDispatchBulkResult>;
  busy?: boolean;
};

/**
 * Additional selectable documents shown alongside the primary scanned
 * dispatch (DispatchResultCard, unchanged) when the truck the guard just
 * scanned is also carrying other open dispatch documents. Unchecked by
 * default — the primary document is always included via the existing
 * single-document verify flow and is never selectable here. Deliberately
 * document-level only (no item_checks / Short-Over UI): per-item quantity
 * counting stays exclusive to the one document the guard is actually
 * looking at.
 */
export function DispatchRelatedVerify({ items, vehicleNo, onSubmit, busy }: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [action, setAction] = useState<GateVerificationStatus | null>(null);
  const [remarks, setRemarks] = useState('');
  const [results, setResults] = useState<VerifyDispatchBulkResult['results'] | null>(null);

  const selectedItems = items.filter((i) => selected[i.reference_name]);
  const selectedCount = selectedItems.length;
  const remarksRequired = action === 'Rejected';
  const canSubmit = selectedCount > 0 && action != null && (!remarksRequired || remarks.trim().length > 0);

  function toggle(referenceName: string) {
    if (busy) return;
    setSelected((prev) => ({ ...prev, [referenceName]: !prev[referenceName] }));
  }

  async function submit() {
    if (!action || !canSubmit) return;
    try {
      const result = await onSubmit({
        references: selectedItems.map((i) => i.reference_name),
        gate_verification_status: action,
        remarks: remarks.trim() || undefined,
      });
      setResults(result.results);
    } catch {
      // feedback handled by the caller's mutation hook
    }
  }

  function reset() {
    setSelected({});
    setAction(null);
    setRemarks('');
    setResults(null);
  }

  if (results) {
    return (
      <View
        style={{
          backgroundColor: COLORS.surfaceAlt,
          borderRadius: borderRadius.md,
          padding: 14,
          marginTop: spacing.sm,
        }}
      >
        <Text style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text }}>
          {results.length} other dispatch{results.length === 1 ? '' : 'es'} on this vehicle processed
        </Text>
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          {results.map((r, idx) => {
            const isFailure = 'error' in r;
            const isVerified = !isFailure && r.gate_verification_status === 'Verified';
            const label = isFailure ? r.reference : r.reference_name;
            const color = isFailure ? COLORS.danger : isVerified ? COLORS.success : COLORS.warn;
            const icon = isFailure ? 'close-circle' : isVerified ? 'checkmark-circle' : 'alert-circle';
            return (
              <View
                key={label + '-' + idx}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: COLORS.surface,
                  borderRadius: borderRadius.sm,
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: spacing.sm,
                }}
              >
                <Ionicons name={icon} size={16} color={color} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, marginLeft: spacing.sm - 2 }}>
                  <Text style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text }}>
                    {label}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color, fontFamily: fontFamily.medium, marginTop: 2 }}>
                    {isFailure ? r.error : r.gate_verification_status}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        <TouchableOpacity
          onPress={reset}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            marginTop: spacing.md,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.sm + 2,
            minHeight: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: COLORS.text, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm }}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: borderRadius.md,
        padding: 14,
        marginTop: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="car-outline" size={18} color={COLORS.text} />
        <Text
          style={{
            marginLeft: 8,
            fontFamily: fontFamily.semiBold,
            fontSize: fontSize.sm,
            color: COLORS.text,
            flex: 1,
          }}
        >
          {vehicleNo || 'This vehicle'} is also carrying {items.length} other open dispatch
          {items.length === 1 ? '' : 'es'} — select any to release together:
        </Text>
      </View>

      {items.map((item) => {
        const isSelected = !!selected[item.reference_name];
        return (
          <TouchableOpacity
            key={item.reference_name}
            onPress={() => toggle(item.reference_name)}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              borderWidth: 1,
              borderColor: isSelected ? COLORS.primary : COLORS.border,
              backgroundColor: isSelected ? '#EEF2FF' : COLORS.surface,
              borderRadius: borderRadius.md,
              padding: 12,
              marginTop: spacing.sm,
            }}
          >
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={20}
              color={isSelected ? COLORS.primary : COLORS.textMuted}
              style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text }}>
                {item.reference_name}
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                {item.reference_doctype}
                {item.dispatch_datetime ? ' · ' + fmtDateTime(item.dispatch_datetime) : ''}
              </Text>
              {item.items_summary ? (
                <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs, marginTop: 2 }}>
                  {item.items_summary}
                </Text>
              ) : null}
              {!item.is_authorized ? (
                <Text
                  style={{
                    color: COLORS.warn,
                    fontSize: fontSize.xs,
                    fontFamily: fontFamily.semiBold,
                    marginTop: 2,
                  }}
                >
                  Not in the authorized status list — use judgement
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}

      <Text
        style={{
          color: selectedCount > 0 ? COLORS.text : COLORS.textMuted,
          fontSize: fontSize.xs,
          fontFamily: fontFamily.medium,
          marginTop: spacing.sm,
          marginBottom: spacing.xs,
        }}
      >
        {selectedCount} selected
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        <TouchableOpacity
          onPress={() => setAction('Verified')}
          disabled={busy || selectedCount === 0}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: action === 'Verified' ? COLORS.success : COLORS.surface,
            borderWidth: 1,
            borderColor: COLORS.success,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.sm + 2,
            minHeight: 44,
            opacity: selectedCount === 0 ? 0.5 : 1,
          }}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={16}
            color={action === 'Verified' ? COLORS.textOnPrimary : COLORS.success}
          />
          <Text
            style={{
              color: action === 'Verified' ? COLORS.textOnPrimary : COLORS.success,
              fontFamily: fontFamily.semiBold,
              marginLeft: 6,
              fontSize: fontSize.xs,
              letterSpacing: 0.3,
            }}
          >
            RELEASE {selectedCount > 0 ? selectedCount + ' SELECTED' : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setAction('Rejected')}
          disabled={busy || selectedCount === 0}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: action === 'Rejected' ? COLORS.danger : COLORS.surface,
            borderWidth: 1,
            borderColor: COLORS.danger,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.sm + 2,
            minHeight: 44,
            opacity: selectedCount === 0 ? 0.5 : 1,
          }}
        >
          <Ionicons
            name="close-circle-outline"
            size={16}
            color={action === 'Rejected' ? COLORS.textOnPrimary : COLORS.danger}
          />
          <Text
            style={{
              color: action === 'Rejected' ? COLORS.textOnPrimary : COLORS.danger,
              fontFamily: fontFamily.semiBold,
              marginLeft: 6,
              fontSize: fontSize.xs,
              letterSpacing: 0.3,
            }}
          >
            REJECT {selectedCount > 0 ? selectedCount + ' SELECTED' : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {remarksRequired ? (
        <View style={{ marginTop: spacing.sm }}>
          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Remarks (required to reject)"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={2}
            editable={!busy}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              fontSize: fontSize.sm,
              color: COLORS.text,
              backgroundColor: COLORS.surface,
              minHeight: 52,
              textAlignVertical: 'top',
            }}
          />
        </View>
      ) : null}

      {action ? (
        <TouchableOpacity
          onPress={submit}
          disabled={!canSubmit || busy}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={{
            backgroundColor: !canSubmit || busy ? COLORS.border : COLORS.primary,
            borderRadius: borderRadius.md,
            paddingVertical: spacing.sm + 2,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: spacing.sm,
            flexDirection: 'row',
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
          ) : (
            <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm }}>
              SUBMIT {selectedCount} {action.toUpperCase()}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
