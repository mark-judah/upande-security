import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReceivingSearchHit, GateVerificationStatus } from '@/lib/services/api';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  matches: ReceivingSearchHit[];
  supplierName: string | null;
  onSubmit: (
    selected: ReceivingSearchHit[],
    status: GateVerificationStatus,
    vehicleNo: string,
    driverName: string,
    remarks: string,
  ) => void;
  busy?: boolean;
  onReset: () => void;
};

/**
 * Shown when a Supplier Badge scan resolves to 2+ open Purchase Orders for
 * one supplier — one driver can genuinely be carrying goods for several of
 * them at once. The guard checks off which ones this delivery actually
 * covers, enters the vehicle/driver ONCE, then releases the whole
 * selection in one action against the bulk endpoint. Same
 * verify/reject/remarks conventions as the single-PO ReceivingResultCard.
 */
export function ReceivingBulkVerify({ matches, supplierName, onSubmit, busy, onReset }: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [action, setAction] = useState<GateVerificationStatus | null>(null);
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [remarks, setRemarks] = useState('');

  const selectedMatches = matches.filter((m) => selected[m.purchase_order]);
  const selectedCount = selectedMatches.length;
  const remarksRequired = action === 'Rejected';
  const canSubmit = selectedCount > 0 && action != null && (!remarksRequired || remarks.trim().length > 0);

  function toggle(purchaseOrder: string) {
    if (busy) return;
    setSelected((prev) => ({ ...prev, [purchaseOrder]: !prev[purchaseOrder] }));
  }

  function submit() {
    if (!action || !canSubmit) return;
    onSubmit(selectedMatches, action, vehicleNo.trim(), driverName.trim(), remarks.trim());
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
      <Text
        style={{
          fontFamily: fontFamily.semiBold,
          fontSize: fontSize.sm,
          color: COLORS.text,
          marginBottom: spacing.sm,
        }}
      >
        {supplierName ?? 'This supplier'} has {matches.length} open orders — select every one this delivery
        covers:
      </Text>

      {matches.map((m) => {
        const isSelected = !!selected[m.purchase_order];
        return (
          <TouchableOpacity
            key={m.purchase_order}
            onPress={() => toggle(m.purchase_order)}
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
              marginBottom: spacing.sm,
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
                {m.purchase_order}
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                {m.po_status}
                {m.schedule_date ? ' · due ' + m.schedule_date : ''}
              </Text>
              {m.items_summary ? (
                <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs, marginTop: 2 }}>
                  {m.items_summary}
                </Text>
              ) : null}
              {!m.supplier_active ? (
                <Text
                  style={{
                    color: COLORS.danger,
                    fontSize: fontSize.xs,
                    fontFamily: fontFamily.semiBold,
                    marginTop: 2,
                  }}
                >
                  Supplier is disabled
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
          marginBottom: spacing.md,
        }}
      >
        {selectedCount} selected
      </Text>

      <View>
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
            paddingVertical: spacing.md,
            minHeight: 48,
            opacity: selectedCount === 0 ? 0.5 : 1,
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
            VERIFY {selectedCount > 0 ? selectedCount + ' SELECTED' : ''}
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
            paddingVertical: spacing.md,
            minHeight: 48,
            opacity: selectedCount === 0 ? 0.5 : 1,
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
            REJECT {selectedCount > 0 ? selectedCount + ' SELECTED' : ''}
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
              SUBMIT {selectedCount} {action.toUpperCase()}
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
          Cancel
        </Text>
      </TouchableOpacity>
    </View>
  );
}
