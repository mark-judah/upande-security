import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useGateStore } from '@/lib/stores/gateStore';
import { useIssueVisitorBadge } from '@/lib/hooks/useIssueVisitorBadge';
import { extractBadgeNumber } from '@/lib/utils/qr';
import { fmtTime } from '@/lib/utils/date';
import { COLORS, spacing, borderRadius, fontFamily, fontSize } from '@/src/core/theme';

type Props = {
  appointmentName: string;
  currentBadge?: number;
  hostReceivedAt?: string;
};

/**
 * Shown once a visitor is checked in. The badge itself is a fixed,
 * pre-printed physical object (see the Visitor Badge doctype) — issuing one
 * here is purely a server-side pointer from that badge number to this
 * appointment, not anything printed fresh per visit.
 */
export function IssueVisitorBadge({ appointmentName, currentBadge, hostReceivedAt }: Props) {
  const [manualInput, setManualInput] = useState('');
  const pendingScannedBadge = useGateStore((s) => s.pendingScannedBadge);
  const setPendingScannedBadge = useGateStore((s) => s.setPendingScannedBadge);
  const issueBadge = useIssueVisitorBadge();

  useEffect(() => {
    if (pendingScannedBadge) {
      const badgeNumber = extractBadgeNumber(pendingScannedBadge);
      setPendingScannedBadge(null);
      if (badgeNumber) {
        issueBadge.mutate({ name: appointmentName, badgeNumber });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScannedBadge]);

  function onManualIssue() {
    const badgeNumber = manualInput.trim();
    if (!badgeNumber) return;
    issueBadge.mutate(
      { name: appointmentName, badgeNumber },
      { onSuccess: () => setManualInput('') },
    );
  }

  // ── Host has confirmed receipt — fully done ─────────────────────
  if (hostReceivedAt) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#F0FDF4',
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          marginTop: spacing.sm,
        }}
      >
        <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
        <Text style={{ color: COLORS.success, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, marginLeft: 6, flex: 1 }}>
          Badge #{currentBadge} — host confirmed receipt at {fmtTime(hostReceivedAt)}
        </Text>
      </View>
    );
  }

  // ── Badge issued, waiting on host to scan ───────────────────────
  if (currentBadge) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFBEB',
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          marginTop: spacing.sm,
        }}
      >
        <Ionicons name="time-outline" size={16} color={COLORS.warn} />
        <Text style={{ color: COLORS.warn, fontSize: fontSize.sm, fontFamily: fontFamily.semiBold, marginLeft: 6, flex: 1 }}>
          Badge #{currentBadge} issued — waiting for host to scan and confirm receipt.
        </Text>
      </View>
    );
  }

  // ── Not issued yet — scan or key in the badge number ────────────
  return (
    <View
      style={{
        marginTop: spacing.sm,
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: borderRadius.md,
        padding: spacing.md,
      }}
    >
      <Text style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text, marginBottom: spacing.sm }}>
        Issue visitor badge
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/scan?intent=badge')}
        activeOpacity={0.8}
        accessibilityRole="button"
        disabled={issueBadge.isPending}
        style={{
          backgroundColor: COLORS.primary,
          opacity: issueBadge.isPending ? 0.6 : 1,
          borderRadius: borderRadius.md,
          paddingVertical: 14,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          marginBottom: spacing.sm,
        }}
      >
        <Ionicons name="qr-code-outline" size={18} color={COLORS.textOnPrimary} />
        <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, marginLeft: 6, letterSpacing: 0.5 }}>
          SCAN BADGE QR
        </Text>
      </TouchableOpacity>

      <Text style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginBottom: spacing.sm }}>
        Or key in the badge number
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          backgroundColor: COLORS.surface,
        }}
      >
        <TextInput
          value={manualInput}
          onChangeText={setManualInput}
          placeholder="Badge number"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad"
          returnKeyType="done"
          editable={!issueBadge.isPending}
          onSubmitEditing={onManualIssue}
          style={{ flex: 1, paddingVertical: 10, fontSize: fontSize.md, color: COLORS.text }}
        />
        <TouchableOpacity onPress={onManualIssue} disabled={issueBadge.isPending} hitSlop={8} activeOpacity={0.6}>
          {issueBadge.isPending ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
