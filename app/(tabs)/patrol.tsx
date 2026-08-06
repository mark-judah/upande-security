import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  getActivePatrol,
  saveActivePatrol,
  clearActivePatrol,
  initPatrolDb,
} from '@/lib/services/patrolDb';
import {
  getPatrolLocationPermissionsStatus,
  requestPatrolLocationPermissions,
  startPatrolLocationUpdates,
  startPatrolForegroundPolling,
  startPatrolTrackingWatchdog,
} from '@/lib/services/patrolTracking';
import { startPatrolSync } from '@/lib/services/patrolGpsSync';
import { generatePatrolTag, sanitizeGuardCode } from '@/lib/services/patrolHelpers';
import { toFrappeDateTime, fmtDateTime } from '@/lib/utils/date';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { useMyShift } from '@/lib/hooks/useMyShift';
import { useCheckInShift } from '@/lib/hooks/useCheckInShift';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { Card } from '@/src/core/ui/Card';
import { COLORS, spacing, radius, fontFamily, fontSize } from '@/src/core/theme';

const STALE_THRESHOLD_MS = 14 * 60 * 60 * 1000;

export default function PatrolHome() {
  const userEmail = useAuthStore((s) => s.user?.email);
  const feedback = useFeedback();
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [perms, setPerms] = useState<{ foreground: boolean; background: boolean } | null>(null);
  const shiftQuery = useMyShift();
  const checkInShift = useCheckInShift();

  useEffect(() => {
    (async () => {
      await initPatrolDb();
      const active = await getActivePatrol();
      if (active && !active.stoppedAt) {
        const age = Date.now() - Date.parse(active.startedAt.replace(' ', 'T'));
        if (Number.isFinite(age) && age > STALE_THRESHOLD_MS) {
          Alert.alert(
            'Stale Patrol Found',
            `A patrol started at ${active.startedAt} is still marked active. Stop it now?`,
            [
              { text: 'Ignore', style: 'cancel', onPress: () => setReady(true) },
              {
                text: 'Stop it',
                style: 'destructive',
                onPress: async () => {
                  await clearActivePatrol();
                  setReady(true);
                },
              },
            ],
          );
          return;
        }
        router.replace('/patrol-active');
        return;
      }
      const p = await getPatrolLocationPermissionsStatus();
      setPerms(p);
      setReady(true);
    })().catch(() => setReady(true));
  }, []);

  const requestPerms = async () => {
    const p = await requestPatrolLocationPermissions();
    setPerms(p);
  };

  const onStart = async () => {
    if (!userEmail) {
      Alert.alert('Not signed in', 'Sign in first.');
      return;
    }
    setStarting(true);
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        Alert.alert('GPS is off', 'Turn on Location Services to start a patrol.');
        return;
      }
      const got = await requestPatrolLocationPermissions();
      setPerms(got);
      if (!got.foreground || (Platform.OS === 'android' && !got.background)) {
        Alert.alert(
          'Permissions needed',
          "Allow location access — on Android choose 'Allow all the time' — so the route can be tracked in the background.",
        );
        return;
      }

      // Sanitised form is only used to keep the patrol_tag URL-safe.
      // The guard value stored + sent in every upload is the raw email so the
      // server can resolve it via frappe.session.user (and fall back to matching
      // the email directly on Employee.user_id).
      const tagSafe = sanitizeGuardCode(userEmail);
      const patrolTag = generatePatrolTag(tagSafe);
      const startedAt = toFrappeDateTime();

      await saveActivePatrol({ patrolTag, guard: userEmail, startedAt, stoppedAt: null });

      const started = await startPatrolLocationUpdates(patrolTag, userEmail);
      if (!started) {
        await clearActivePatrol();
        Alert.alert('Could not start', 'Check permissions and try again.');
        return;
      }
      startPatrolForegroundPolling(patrolTag, userEmail);
      startPatrolTrackingWatchdog(patrolTag, userEmail);
      // Sync is entirely client-driven: no ping to the ERP on start.
      // The 2-minute sync loop ships queued points; createPatrolEntry
      // lazy-creates the Patrol Session on the first successful upload.
      startPatrolSync(patrolTag);

      router.replace('/patrol-active');
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Could not start patrol');
    } finally {
      setStarting(false);
    }
  };

  const needsPerms =
    perms && (!perms.foreground || (Platform.OS === 'android' && !perms.background));

  return (
    <Screen title="Patrol" loading={!ready}>
      <Text style={s.subtitle}>Start a patrol to begin recording your route.</Text>

      {shiftQuery.data ? (
        <Card style={s.shiftCard}>
          <View style={s.shiftHeader}>
            <Ionicons
              name={shiftQuery.data.status === 'Active' ? 'time' : 'time-outline'}
              size={18}
              color={shiftQuery.data.status === 'Active' ? COLORS.success : COLORS.textMuted}
            />
            <Text style={s.shiftTitle}>
              {shiftQuery.data.status === 'Active' ? 'On shift now' : 'Upcoming shift'}
            </Text>
          </View>
          <Text style={s.shiftBody}>
            {shiftQuery.data.shift_type} shift · {shiftQuery.data.farm}
          </Text>
          <Text style={s.shiftTime}>
            {fmtDateTime(shiftQuery.data.start_date)} → {fmtDateTime(shiftQuery.data.end_date)}
          </Text>
          {shiftQuery.data.guard_type === 'External' && !shiftQuery.data.checked_in ? (
            <Button
              label="CHECK IN TO SHIFT"
              iconLeft="checkmark-circle-outline"
              onPress={() => checkInShift.mutate()}
              loading={checkInShift.isPending}
              disabled={checkInShift.isPending}
              style={s.shiftCheckInBtn}
            />
          ) : null}
          {shiftQuery.data.guard_type === 'External' && shiftQuery.data.checked_in ? (
            <View style={s.shiftCheckedInRow}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={s.shiftCheckedInText}>Checked in</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {needsPerms ? (
        <Card style={s.permCard}>
          <View style={s.permHeader}>
            <Ionicons name="location" size={20} color={COLORS.text} />
            <Text style={s.permTitle}>Location permission required</Text>
          </View>
          <Text style={s.permBody}>
            Patrols need background location to record the route while the phone is locked. On
            Android, choose &quot;Allow all the time&quot;.
          </Text>
          <Button label="GRANT PERMISSIONS" onPress={requestPerms} style={s.permBtn} />
        </Card>
      ) : null}

      <Card style={s.readyCard}>
        <View style={s.iconCircle}>
          <Ionicons name="walk-outline" size={40} color={COLORS.textOnPrimary} />
        </View>
        <Text style={s.readyTitle}>Ready to patrol</Text>
        <Text style={s.readyBody}>
          Your GPS path will be recorded every few seconds and uploaded automatically.
        </Text>

        <Button
          label="START PATROL"
          iconLeft="play"
          onPress={onStart}
          disabled={!!needsPerms}
          loading={starting}
          style={s.startBtn}
        />
      </Card>

      <Button
        label="FILE PATROL REPORT"
        iconLeft="document-text-outline"
        variant="outline"
        onPress={() => router.push('/patrol-report')}
        style={s.fileReportBtn}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: COLORS.textMuted,
    marginBottom: spacing.xl,
  },
  shiftCard: {
    marginBottom: spacing.lg,
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  shiftTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: COLORS.text,
    marginLeft: spacing.sm,
  },
  shiftBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: COLORS.text,
  },
  shiftTime: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  shiftCheckInBtn: {
    marginTop: spacing.md,
  },
  shiftCheckedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  shiftCheckedInText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: COLORS.success,
    marginLeft: spacing.xs,
  },
  permCard: {
    marginBottom: spacing.lg,
  },
  permHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  permTitle: {
    fontFamily: fontFamily.semiBold,
    color: COLORS.text,
    marginLeft: spacing.sm,
  },
  permBody: {
    fontFamily: fontFamily.regular,
    color: COLORS.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  permBtn: {
    alignSelf: 'stretch',
  },
  readyCard: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  readyTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: COLORS.text,
    marginBottom: spacing.xs,
  },
  readyBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  startBtn: {
    minWidth: 220,
    alignSelf: 'stretch',
  },
  fileReportBtn: {
    marginTop: spacing.lg,
  },
});
