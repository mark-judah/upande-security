import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
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
        router.replace('/(app)/(tabs)/patrol');
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

      router.replace('/(app)/(tabs)/patrol');
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Could not stop patrol');
    } finally {
      setStopping(false);
    }
  };

  if (!patrolTag) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  const pending = syncStatus?.pending ?? 0;
  const lastSyncAgoSec = syncStatus?.lastSyncAt
    ? Math.max(0, Math.floor((Date.now() - syncStatus.lastSyncAt) / 1000))
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 4 }}>
          Patrol Active
        </Text>
        <Text style={{ fontSize: 12, color: '#666666', marginBottom: 20 }}>
          {patrolTag}
        </Text>

        <View
          style={{
            backgroundColor: '#000000',
            borderRadius: 14,
            padding: 24,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: '#AAAAAA',
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.8,
              marginBottom: 8,
            }}
          >
            ELAPSED
          </Text>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 44,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatElapsed(elapsedMs)}
          </Text>
          {startedAt ? (
            <Text style={{ color: '#888888', fontSize: 12, marginTop: 8 }}>
              Started {startedAt}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            backgroundColor: '#F5F5F5',
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: trackingActive ? '#000000' : '#999999',
              marginRight: 10,
            }}
          />
          <Text style={{ flex: 1, color: '#111111', fontWeight: '600', fontSize: 13 }}>
            {trackingActive === null
              ? 'Checking GPS…'
              : trackingActive
                ? 'GPS tracking active'
                : 'GPS tracking stopped'}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: '#F5F5F5',
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <MaterialIcons name="cloud-upload" size={18} color="#333333" />
          <Text style={{ flex: 1, marginLeft: 10, color: '#111111', fontWeight: '600', fontSize: 13 }}>
            {pending === 0 ? 'All points uploaded' : `${pending} pending upload${pending === 1 ? '' : 's'}`}
          </Text>
          {lastSyncAgoSec !== null ? (
            <Text style={{ color: '#666666', fontSize: 11 }}>{lastSyncAgoSec}s ago</Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={async () => {
            if (!patrolTag) return;
            const res = await syncPatrolQueueNow(patrolTag);
            feedback.success(
              `Sync: uploaded ${res.uploaded}, ${res.pending} pending`,
            );
          }}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#F5F5F5',
            borderRadius: 10,
            paddingVertical: 12,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            marginBottom: 12,
          }}
        >
          <MaterialIcons name="sync" size={18} color="#000000" />
          <Text
            style={{
              color: '#000000',
              fontWeight: '600',
              marginLeft: 6,
              fontSize: 13,
            }}
          >
            Sync Now
          </Text>
        </TouchableOpacity>

        {syncStatus?.lastError ? (
          <View
            style={{
              backgroundColor: '#F5F5F5',
              borderLeftWidth: 3,
              borderLeftColor: '#666666',
              borderRadius: 8,
              padding: 10,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#333333', fontSize: 12 }}>
              Last sync error: {syncStatus.lastError}
            </Text>
            <Text style={{ color: '#999999', fontSize: 11, marginTop: 2 }}>
              Points stay queued — will retry in 30s.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={onStop}
          disabled={stopping}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 2,
            borderColor: '#000000',
            opacity: stopping ? 0.6 : 1,
            borderRadius: 10,
            paddingVertical: 18,
            minHeight: 56,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            marginTop: 20,
          }}
        >
          {stopping ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <>
              <MaterialIcons name="stop" size={22} color="#000000" />
              <Text
                style={{
                  color: '#000000',
                  fontWeight: '700',
                  marginLeft: 6,
                  letterSpacing: 0.8,
                  fontSize: 15,
                }}
              >
                STOP PATROL
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
