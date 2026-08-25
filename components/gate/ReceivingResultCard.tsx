import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReceivingSearchHit, GateVerificationStatus } from '@/lib/services/api';
import { fmtDateTime } from '@/lib/utils/date';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  result: ReceivingSearchHit;
  onDecide: (status: GateVerificationStatus, vehicleNo: string, driverName: string, remarks: string) => void;
  busy?: boolean;
  onReset: () => void;
};

/**
 * Shows the matched Purchase Order and lets the guard record their
 * Verify / Reject decision. This is an identity/paperwork check only — the
 * guard confirms a PO exists for an active supplier and logs vehicle +
 * driver, nothing more. Cargo contents are never inspected or judged here;
 * that's the stock team's job at receiving (Purchase Receipt), separate
 * from this gate record entirely.
 *
 * Unlike Dispatch (which snapshots vehicle/driver from the source
 * document), a PO carries no vehicle info of its own, so those are
 * captured fresh here. `is_authorized` is informational only — the server
 * doesn't block on it, so it's a warning banner, not a disable.
 */
export function ReceivingResultCard({ result, onDecide, busy, onReset }: Props) {
  const [action, setAction] = useState<GateVerificationStatus | null>(null);
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [remarks, setRemarks] = useState('');

  const remarksRequired = action === 'Rejected';
  const canSubmit = action != null && (!remarksRequired || remarks.trim().length > 0);

  function submit() {
    if (!action || !canSubmit) return;
    onDecide(action, vehicleNo.trim(), driverName.trim(), remarks.trim());
  }

  return (
    <View
      style={{
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: borderRadius.md,
        padding: 14,
        marginVertical: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Ionicons name="cube-outline" size={22} color={COLORS.text} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
            {result.supplier_name}
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
            {result.purchase_order}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: spacing.sm, gap: 4 }}>
        {result.items_summary ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>
            Items: {result.items_summary}
          </Text>
        ) : null}
        {result.schedule_date ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>
            Expected: {fmtDateTime(result.schedule_date)}
          </Text>
        ) : null}
        {result.po_status ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>
            PO Status: {result.po_status}
          </Text>
        ) : null}
        {!result.supplier_active ? (
          <Text style={{ color: COLORS.danger, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold }}>
            Supplier is disabled — not an active supplier
          </Text>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: result.is_authorized ? '#F0FDF4' : '#FFFBEB',
          borderRadius: borderRadius.sm,
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: spacing.sm - 2,
          marginTop: spacing.md,
        }}
      >
        <Ionicons
          name={result.is_authorized ? 'checkmark-circle' : 'warning-outline'}
          size={16}
          color={result.is_authorized ? COLORS.success : COLORS.warn}
        />
        <Text
          style={{
            color: result.is_authorized ? COLORS.success : COLORS.warn,
            fontSize: fontSize.xs,
            fontFamily: fontFamily.semiBold,
            marginLeft: spacing.sm - 2,
            flex: 1,
          }}
        >
          {result.is_authorized
            ? 'PO matched and supplier is active — cleared to log this arrival'
            : 'PO/supplier check did not pass — confirm identity before allowing entry'}
        </Text>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <Text
          style={{
            fontFamily: fontFamily.semiBold,
            fontSize: fontSize.sm,
            color: COLORS.text,
            marginBottom: spacing.xs,
          }}
        >
          Vehicle No
        </Text>
        <TextInput
          value={vehicleNo}
          onChangeText={(v) => setVehicleNo(v.toUpperCase())}
          placeholder="e.g. KAA 123A"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            fontSize: 14,
            color: COLORS.text,
            backgroundColor: COLORS.surface,
          }}
        />
      </View>

      <View style={{ marginTop: spacing.sm }}>
        <Text
          style={{
            fontFamily: fontFamily.semiBold,
            fontSize: fontSize.sm,
            color: COLORS.text,
            marginBottom: spacing.xs,
          }}
        >
          Driver Name
        </Text>
        <TextInput
          value={driverName}
          onChangeText={setDriverName}
          placeholder="Driver's name"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="words"
          editable={!busy}
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            fontSize: 14,
            color: COLORS.text,
            backgroundColor: COLORS.surface,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <TouchableOpacity
          onPress={() => setAction('Verified')}
          disabled={busy}
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
            paddingVertical: spacing.md,
            minHeight: 48,
          }}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={action === 'Verified' ? COLORS.textOnPrimary : COLORS.success}
          />
          <Text
            style={{
              color: action === 'Verified' ? COLORS.textOnPrimary : COLORS.success,
              fontFamily: fontFamily.semiBold,
              marginLeft: 6,
              letterSpacing: 0.3,
            }}
          >
            VERIFY
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setAction('Rejected')}
          disabled={busy}
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
            paddingVertical: spacing.md,
            minHeight: 48,
          }}
        >
          <Ionicons
            name="close-circle-outline"
            size={18}
            color={action === 'Rejected' ? COLORS.textOnPrimary : COLORS.danger}
          />
          <Text
            style={{
              color: action === 'Rejected' ? COLORS.textOnPrimary : COLORS.danger,
              fontFamily: fontFamily.semiBold,
              marginLeft: 6,
              letterSpacing: 0.3,
            }}
          >
            REJECT
          </Text>
        </TouchableOpacity>
      </View>

      {remarksRequired ? (
        <View style={{ marginTop: spacing.md }}>
          <Text
            style={{
              fontFamily: fontFamily.semiBold,
              fontSize: fontSize.sm,
              color: COLORS.text,
              marginBottom: spacing.xs,
            }}
          >
            Remarks (required to reject)
          </Text>
          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Why was entry refused? (no PO, wrong vehicle/driver, supplier not active)"
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
              fontSize: fontSize.md,
              color: COLORS.text,
              backgroundColor: COLORS.surface,
              minHeight: 60,
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
            paddingVertical: spacing.md,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: spacing.md,
            flexDirection: 'row',
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
          ) : (
            <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, letterSpacing: 0.5 }}>
              SUBMIT {action.toUpperCase()}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={onReset}
        disabled={busy}
        activeOpacity={0.7}
        style={{ alignItems: 'center', paddingVertical: 10, marginTop: 4 }}
      >
        <Text style={{ color: COLORS.textMuted, fontSize: fontSize.sm, fontFamily: fontFamily.regular }}>
          Search another
        </Text>
      </TouchableOpacity>
    </View>
  );
}
