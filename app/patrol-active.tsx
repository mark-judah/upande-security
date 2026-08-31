import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  getActivePatrol,
  clearActivePatrol,
  markPatrolStopped,
  initPatrolDb,
} from '@/lib/services/patrolDb';
import {
  isPatrolTrackingActive,
  stopPatrolLocationUpdates,
  stopPatrolForegroundPolling,
  stopPatrolTrackingWatchdog,
} from '@/lib/services/patrolTracking';
import {
  subscribePatrolSyncStatus,
  syncPatrolQueueNow,
  stopPatrolSync,
  ensurePatrolSyncRunning,
  type PatrolSyncStatus,
} from '@/lib/services/patrolGpsSync';
import { toFrappeDateTime } from '@/lib/utils/date';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { Card } from '@/src/core/ui/Card';
import { COLORS, spacing, radius, fontFamily, fontSize } from '@/src/core/theme';

function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total / 60) % 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function ActivePatrol() {
  const feedback = useFeedback();
  const [patrolTag, setPatrolTag] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [syncStatus, setSyncStatus] = useState<PatrolSyncStatus | null>(null);
  const [trackingActive, setTrackingActive] = useState<boolean | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    (async () => {
      await initPatrolDb();
      const active = await getActivePatrol();
      if (!active || active.stoppedAt) {
        router.replace('/patrol');
        return;
      }
      setPatrolTag(active.patrolTag);
      setStartedAt(active.startedAt);
      // Watchdog: whenever the guard opens the active screen, make sure
      // the background 2-minute sync loop is running for this patrol tag.
      // If JS was killed and restarted, this restarts the loop.
      ensurePatrolSyncRunning(active.patrolTag);
      const tracking = await isPatrolTrackingActive();
      setTrackingActive(tracking);
    })();
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    const startMs = Date.parse(startedAt.replace(' ', 'T'));
    if (!Number.isFinite(startMs)) return;
    const tick = () => setElapsedMs(Date.now() - startMs);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    const unsub = subscribePatrolSyncStatus((s) => setSyncStatus(s));
    return unsub;
  }, []);

  useEffect(() => {
    if (!patrolTag) return;
    const id = setInterval(async () => {
      const tracking = await isPatrolTrackingActive();
      setTrackingActive(tracking);
    }, 10_000);
    return () => clearInterval(id);
  }, [patrolTag]);

  const onStop = () => {
    Alert.alert(
      'Stop Patrol?',
      'This will stop GPS tracking and upload remaining points.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: doStop },
      ],
    );
  };

  const doStop = async () => {
    if (!patrolTag) return;
    setStopping(true);
    try {
      await Promise.race([
        syncPatrolQueueNow(patrolTag),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);

      stopPatrolSync();
      stopPatrolForegroundPolling();
      stopPatrolTrackingWatchdog();
      await stopPatrolLocationUpdates();

      // No server notification on stop — the client is the source of truth.
      // Any points still queued will keep uploading until they flush, then the
      // local queue is empty and nothing else happens server-side.
      const endedAt = toFrappeDateTime();
      await markPatrolStopped(endedAt);
      await clearActivePatrol();

      router.replace('/patrol');
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Could not stop patrol');
    } finally {
      setStopping(false);
    }
  };

  const pending = syncStatus?.pending ?? 0;
  const lastSyncAgoSec = syncStatus?.lastSyncAt
    ? Math.max(0, Math.floor((Date.now() - syncStatus.lastSyncAt) / 1000))
    : null;

  return (
    <Screen title="Patrol Active" loading={!patrolTag}>
      <Text style={s.tagLabel}>{patrolTag}</Text>

      <Card style={s.timerCard}>
        <Text style={s.elapsedLabel}>ELAPSED</Text>
        <Text style={s.elapsedValue}>{formatElapsed(elapsedMs)}</Text>
        {startedAt ? (
          <Text style={s.startedLabel}>Started {startedAt}</Text>
        ) : null}
      </Card>

      <Card style={s.statusRow}>
        <View
          style={[
            s.dot,
            { backgroundColor: trackingActive ? COLORS.success : COLORS.textMuted },
          ]}
        />
        <Text style={s.statusText}>
          {trackingActive === null
            ? 'Checking GPS…'
            : trackingActive
              ? 'GPS tracking active'
              : 'GPS tracking stopped'}
        </Text>
      </Card>

      <Card style={s.syncRow}>
        <Ionicons name="cloud-upload-outline" size={18} color={COLORS.textSecondary} />
        <Text style={s.syncText}>
          {pending === 0 ? 'All points uploaded' : `${pending} pending upload${pending === 1 ? '' : 's'}`}
        </Text>
        {lastSyncAgoSec !== null ? (
          <Text style={s.syncAgo}>{lastSyncAgoSec}s ago</Text>
        ) : null}
      </Card>

      <Button
        label="Sync Now"
        iconLeft="refresh"
        variant="outline"
        onPress={async () => {
          if (!patrolTag) return;
          const res = await syncPatrolQueueNow(patrolTag);
          feedback.success(
            `Sync: uploaded ${res.uploaded}, ${res.pending} pending`,
          );
        }}
        style={s.syncBtn}
      />

      {syncStatus?.lastError ? (
        <Card style={s.errorCard}>
          <Text style={s.errorText}>Last sync error: {syncStatus.lastError}</Text>
          <Text style={s.errorHint}>Points stay queued — will retry in 30s.</Text>
        </Card>
      ) : null}

      <Button
        label="FILE PATROL REPORT"
        iconLeft="document-text-outline"
        variant="outline"
        onPress={() => router.push('/patrol-report')}
        style={s.fileReportBtn}
      />

      <Button
        label="SCAN ASSETS"
        iconLeft="qr-code-outline"
        variant="outline"
        onPress={() => router.push('/asset-scan')}
        style={s.fileReportBtn}
      />

      <Button
        label="STOP PATROL"
        iconLeft="stop"
        variant="outline"
        onPress={onStop}
        disabled={stopping}
        loading={stopping}
        style={s.stopBtn}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  tagLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    marginBottom: spacing.xl,
  },
  timerCard: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    marginBottom: spacing.md,
    paddingVertical: spacing.xl,
  },
  elapsedLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  elapsedValue: {
    color: COLORS.textOnPrimary,
    fontSize: 44,
    fontFamily: fontFamily.bold,
    // @ts-ignore — tabular-nums is valid in RN
    fontVariant: ['tabular-nums'],
  },
  startedLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    marginTop: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.md,
  },
  statusText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: COLORS.text,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  syncText: {
    flex: 1,
    marginLeft: spacing.md,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: COLORS.text,
  },
  syncAgo: {
    fontFamily: fontFamily.regular,
    color: COLORS.textMuted,
    fontSize: fontSize.xs,
  },
  syncBtn: {
    marginBottom: spacing.md,
  },
  errorCard: {
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: fontFamily.regular,
    color: COLORS.textSecondary,
    fontSize: fontSize.xs,
  },
  errorHint: {
    fontFamily: fontFamily.regular,
    color: COLORS.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  stopBtn: {
    marginTop: spacing.xl,
  },
  fileReportBtn: {
    marginTop: spacing.md,
  },
});
