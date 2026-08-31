import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { VerifyReceivingBulkResult } from '@/lib/services/api';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  results: VerifyReceivingBulkResult['results'];
  onDone: () => void;
};

/**
 * Per-PO outcome after a bulk verify/reject — some can succeed and others
 * fail independently (e.g. a PO that got cancelled between search and
 * submit), so this always lists every selection's own result rather than
 * a single pass/fail banner for the whole action.
 */
export function ReceivingBulkResultSummary({ results, onDone }: Props) {
  const succeeded = results.filter((r) => 'name' in r);
  const failed = results.filter((r) => 'error' in r);

  return (
    <View
      style={{
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: borderRadius.md,
        padding: 14,
        marginVertical: spacing.sm,
      }}
    >
      <Text style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text }}>
        {results.length} PO{results.length === 1 ? '' : 's'} processed
      </Text>

      <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
        {results.map((r, idx) => {
          const isFailure = 'error' in r;
          const isVerified = !isFailure && r.gate_verification_status === 'Verified';
          const label = isFailure ? r.reference : r.purchase_order;
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
              <Ionicons name={icon} size={18} color={color} style={{ marginTop: 1 }} />
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

      <Text
        style={{
          marginTop: spacing.md,
          color: COLORS.textSecondary,
          fontSize: fontSize.sm,
          fontFamily: fontFamily.regular,
        }}
      >
        {succeeded.length > 0
          ? 'Verified/Rejected POs recorded. Once this truck leaves after offloading, confirm each one from the "Awaiting departure" list below.'
          : failed.length > 0
            ? 'None of the selected POs could be processed.'
            : ''}
      </Text>

      <TouchableOpacity
        onPress={onDone}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          marginTop: spacing.md,
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: borderRadius.md,
          paddingVertical: spacing.md,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: COLORS.text, fontFamily: fontFamily.semiBold }}>Verify another supplier delivery</Text>
      </TouchableOpacity>
    </View>
  );
}
