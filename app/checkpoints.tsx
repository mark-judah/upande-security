import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getActivePatrol, initPatrolDb } from '@/lib/services/patrolDb';
import { useGateStore } from '@/lib/stores/gateStore';
import { usePatrolCheckpoints, useScanCheckpoint } from '@/lib/hooks/useCheckpoints';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { bestFix } from '@/lib/utils/gps';
import { fmtTime } from '@/lib/utils/date';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { Card } from '@/src/core/ui/Card';
import { COLORS, spacing, fontFamily, fontSize, radius } from '@/src/core/theme';
import type { ScanCheckpointResult } from '@/lib/services/api';

/** Checkpoints for the patrol in progress: the server's shuffled order for
 * this patrol, which are done, and a scan button. A scan only counts at the
 * checkpoint itself (the server checks the GPS fix against the checkpoint's
 * position), so this waits a few seconds for a sharp fix before sending. */
export default function PatrolCheckpoints() {
  const feedback = useFeedback();
  const [patrolTag, setPatrolTag] = useState<string | null>(null);
  const [noPatrol, setNoPatrol] = useState(false);
  const plan = usePatrolCheckpoints(patrolTag);
  const scan = useScanCheckpoint();
  const pending = useGateStore((s) => s.pendingScannedCheckpoint);
  const setPending = useGateStore((s) => s.setPendingScannedCheckpoint);
  const [locating, setLocating] = useState<number | null | undefined>(undefined);
  const [last, setLast] = useState<ScanCheckpointResult | null>(null);

  useEffect(() => {
    (async () => {
      await initPatrolDb();
      const active = await getActivePatrol();
      if (!active || active.stoppedAt) setNoPatrol(true);
      else setPatrolTag(active.patrolTag);
    })();
  }, []);

  useEffect(() => {
    if (!pending || !patrolTag) return;
    const code = pending;
    setPending(null);
    (async () => {
      setLocating(null);
      try {
        const fix = await bestFix({ onUpdate: (acc) => setLocating(acc) });
        if (!fix) {
          feedback.warning('Location permission is needed to record a checkpoint');
          return;
        }
        const result = await scan.mutateAsync({
          code,
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
          mocked: fix.mocked ? 1 : 0,
          patrol: patrolTag,
        });
        setLast(result);
      } catch {
        // useScanCheckpoint already shows the error
      } finally {
        setLocating(undefined);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, patrolTag]);

  const busy = locating !== undefined || scan.isPending;
  const data = plan.data;

  if (noPatrol) {
    return (
      <Screen title="Checkpoints">
        <Card style={s.center}>
          <Ionicons name="walk-outline" size={32} color={COLORS.textMuted} />
          <Text style={s.muted}>Start a patrol first - checkpoints are scanned during a patrol.</Text>
          <Button label="BACK" variant="outline" onPress={() => router.back()} style={s.topGap} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Checkpoints" loading={!patrolTag || plan.isLoading}>
      <Card style={s.progressCard}>
        <Text style={s.progressLabel}>THIS PATROL</Text>
        <Text style={s.progressValue}>
          {data ? `${data.done} / ${data.total}` : '-'}
        </Text>
        <Text style={s.progressSub}>
          {data?.route ? `Route: ${data.route}` : data?.farm ? data.farm : ''}
        </Text>
      </Card>

      <Button
        label="SCAN CHECKPOINT"
        iconLeft="qr-code-outline"
        onPress={() => router.push('/scan?intent=checkpoint')}
        loading={busy}
        disabled={busy || !patrolTag}
      />

      {locating !== undefined ? (
        <Card style={StyleSheet.flatten([s.resultCard, s.center])}>
          <ActivityIndicator color={COLORS.text} />
          <Text style={s.muted}>
            Getting a precise GPS fix{locating ? ` (±${Math.round(locating)} m)` : ''}… stand at the checkpoint
          </Text>
        </Card>
      ) : last ? (
        <Card style={StyleSheet.flatten([s.resultCard, { borderColor: last.accepted ? COLORS.success : COLORS.danger }])}>
          <View style={s.row}>
            <Ionicons
              name={last.accepted ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={last.accepted ? COLORS.success : COLORS.danger}
            />
            <Text style={s.resultTitle}>{last.accepted ? 'Recorded' : `Not recorded - ${last.result}`}</Text>
          </View>
          <Text style={s.resultMsg}>{last.message}</Text>
        </Card>
      ) : null}

      {data && data.total === 0 ? (
        <Card style={StyleSheet.flatten([s.topGap, s.center])}>
          <Text style={s.muted}>
            No checkpoints are set up for your farm yet. Ask your supervisor.
          </Text>
        </Card>
      ) : null}

      {data?.checkpoints.map((c) => (
        <Card key={c.checkpoint} style={s.item}>
          <View style={[s.badge, c.scanned ? s.badgeDone : null]}>
            {c.scanned ? (
              <Ionicons name="checkmark" size={16} color={COLORS.textOnPrimary} />
            ) : (
              <Text style={s.badgeText}>{c.position}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.itemTitle}>{c.checkpoint_name}</Text>
            {c.location_hint ? <Text style={s.itemSub}>{c.location_hint}</Text> : null}
          </View>
          {c.scanned_at ? <Text style={s.itemTime}>{fmtTime(c.scanned_at)}</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center' },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  topGap: { marginTop: spacing.lg },
  progressCard: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    marginBottom: spacing.md,
    paddingVertical: spacing.lg,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.8,
  },
  progressValue: {
    color: COLORS.textOnPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 36,
    marginTop: spacing.xs,
  },
  progressSub: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  resultCard: { marginTop: spacing.md, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', alignItems: 'center' },
  resultTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: COLORS.text,
    marginLeft: spacing.sm,
  },
  resultMsg: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: COLORS.textSecondary,
    marginTop: spacing.xs,
  },
  item: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  badge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  badgeDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  badgeText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs, color: COLORS.textSecondary },
  itemTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text },
  itemSub: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
  itemTime: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: COLORS.textMuted },
});
