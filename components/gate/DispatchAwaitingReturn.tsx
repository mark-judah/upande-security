import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatchStore } from '@/lib/stores/dispatchStore';
import { useConfirmDispatchReturn } from '@/lib/hooks/useConfirmDispatchReturn';
import { fmtTime } from '@/lib/utils/date';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

/**
 * Dispatches verified at the gate but not yet confirmed returned. Persisted
 * across screen sessions / app restarts (see dispatchStore) since a truck
 * checked in on one shift may only come back — or never come back — much
 * later, possibly to a different guard.
 */
export function DispatchAwaitingReturn() {
  const pending = useDispatchStore((s) => s.pending);
  const confirmReturn = useConfirmDispatchReturn();

  if (pending.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text
        style={{
          fontFamily: fontFamily.semiBold,
          fontSize: fontSize.sm,
          color: COLORS.textSecondary,
          marginBottom: spacing.sm,
        }}
      >
        Awaiting return ({pending.length})
      </Text>
      {pending.map((entry) => (
        <View
          key={entry.name}
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.sm,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.text} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text }}>
                {entry.reference_name}
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
                {[entry.vehicle_no, entry.driver_name, entry.farm].filter(Boolean).join(' · ') || '—'}
                {' · Verified '}
                {fmtTime(entry.verified_at)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => confirmReturn.mutate(entry.name)}
            disabled={confirmReturn.isPending}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: COLORS.success,
              opacity: confirmReturn.isPending ? 0.6 : 1,
              borderRadius: borderRadius.sm,
              paddingVertical: spacing.sm + 2,
              marginTop: spacing.sm,
              minHeight: 40,
            }}
          >
            {confirmReturn.isPending ? (
              <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={16} color={COLORS.textOnPrimary} />
                <Text
                  style={{
                    color: COLORS.textOnPrimary,
                    fontFamily: fontFamily.semiBold,
                    marginLeft: spacing.sm - 2,
                    fontSize: fontSize.sm,
                    letterSpacing: 0.3,
                  }}
                >
                  CONFIRM RETURN
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}
