import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DispatchSearchHit, GateVerificationStatus } from '@/lib/services/api';
import { fmtDateTime } from '@/lib/utils/date';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';
import { DispatchItemChecklist } from './DispatchItemChecklist';

type Props = {
  result: DispatchSearchHit;
  onDecide: (status: GateVerificationStatus, remarks: string) => void;
  busy?: boolean;
  onReset: () => void;
  /** Guard's entered actual counts, keyed by the source document's row_id.
   * Lifted up to DispatchGatePanel so it survives across a decision being
   * taken and can be threaded into the verify mutation's item_checks. */
  itemCheckValues: Record<string, string>;
  onItemCheckChange: (rowId: string, text: string) => void;
  /** Guard-entered vehicle/driver, lifted to DispatchGatePanel so they
   * survive across a decision being taken and thread into the verify
   * mutation as vehicle_no/driver_name — AUTHORITATIVE over whatever the
   * source document says, not just a display fallback. Pre-filled from
   * result.vehicle_no/driver_name but always editable so the guard can
   * confirm or correct them (e.g. a truck/driver swap the source document
   * doesn't know about yet). */
  vehicleNo: string;
  onVehicleNoChange: (text: string) => void;
  driverName: string;
  onDriverNameChange: (text: string) => void;
};

/**
 * Shows the matched dispatch document and lets the guard record their
 * Verify / Reject decision. `is_authorized` is informational only — the
 * server doesn't block on it, so we surface it as a warning banner rather
 * than disabling anything.
 */
export function DispatchResultCard({
  result,
  onDecide,
  busy,
  onReset,
  itemCheckValues,
  onItemCheckChange,
  vehicleNo,
  onVehicleNoChange,
  driverName,
  onDriverNameChange,
}: Props) {
  const [action, setAction] = useState<GateVerificationStatus | null>(null);
  const [remarks, setRemarks] = useState('');

  const remarksRequired = action === 'Rejected';
  const canSubmit = action != null && (!remarksRequired || remarks.trim().length > 0);
  const alreadyVerified = result.already_verified === true;

  function submit() {
    if (!action || !canSubmit) return;
    onDecide(action, remarks.trim());
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
        <Ionicons name="document-text-outline" size={22} color={COLORS.text} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
            {result.reference_name}
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
            {result.reference_doctype}
          </Text>
        </View>
      </View>

      {alreadyVerified ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: '#FFFBEB',
            borderRadius: borderRadius.sm,
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: spacing.sm + 2,
            marginTop: spacing.md,
          }}
        >
          <Ionicons name="alert-circle" size={18} color={COLORS.warn} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, marginLeft: spacing.sm - 2 }}>
            <Text
              style={{
                color: COLORS.warn,
                fontSize: fontSize.sm,
                fontFamily: fontFamily.semiBold,
              }}
            >
              Already verified
            </Text>
            <Text
              style={{
                color: COLORS.warn,
                fontSize: fontSize.xs,
                fontFamily: fontFamily.regular,
                marginTop: 2,
              }}
            >
              This dispatch was already verified
              {result.already_verified_by ? ' by ' + result.already_verified_by : ''}
              {result.already_verified_at ? ' at ' + fmtDateTime(result.already_verified_at) : ''}.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fontFamily.semiBold,
              fontSize: fontSize.xs,
              color: COLORS.textMuted,
              marginBottom: 4,
            }}
          >
            Vehicle No.
          </Text>
          <TextInput
            value={vehicleNo}
            onChangeText={onVehicleNoChange}
            placeholder="e.g. KDA 123A"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
            editable={!busy && !alreadyVerified}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: borderRadius.sm,
              paddingHorizontal: spacing.sm + 2,
              paddingVertical: spacing.sm - 2,
              fontSize: fontSize.md,
              color: COLORS.text,
              backgroundColor: COLORS.surfaceAlt,
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fontFamily.semiBold,
              fontSize: fontSize.xs,
              color: COLORS.textMuted,
              marginBottom: 4,
            }}
          >
            Driver Name
          </Text>
          <TextInput
            value={driverName}
            onChangeText={onDriverNameChange}
            placeholder="Driver's name"
            placeholderTextColor={COLORS.textMuted}
            editable={!busy && !alreadyVerified}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: borderRadius.sm,
              paddingHorizontal: spacing.sm + 2,
              paddingVertical: spacing.sm - 2,
              fontSize: fontSize.md,
              color: COLORS.text,
              backgroundColor: COLORS.surfaceAlt,
            }}
          />
        </View>
      </View>

      <View style={{ marginTop: spacing.sm, gap: 4 }}>
        {result.dispatch_datetime ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>
            Dispatched: {fmtDateTime(result.dispatch_datetime)}
          </Text>
        ) : null}
        {result.farm ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>Farm: {result.farm}</Text>
        ) : null}
        {result.items_summary ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>
            Items: {result.items_summary}
          </Text>
        ) : null}
        {result.source_status ? (
          <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.sm }}>
            Status: {result.source_status}
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
            ? 'Source document status is authorized for dispatch'
            : 'Source document status is NOT in the authorized list — use judgement'}
        </Text>
      </View>

      {result.expected_items.length > 0 ? (
        <DispatchItemChecklist
          items={result.expected_items}
          values={itemCheckValues}
          onChange={onItemCheckChange}
          disabled={busy}
        />
      ) : null}

      {!alreadyVerified ? (
      <>
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
            placeholder="Why doesn't this match?"
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
      </>
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
