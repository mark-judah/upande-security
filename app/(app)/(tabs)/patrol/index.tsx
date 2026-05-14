import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
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
import { toFrappeDateTime } from '@/lib/utils/date';
import { useFeedback } from '@/lib/hooks/useFeedback';

const STALE_THRESHOLD_MS = 14 * 60 * 60 * 1000;

export default function PatrolHome() {
  const userEmail = useAuthStore((s) => s.user?.email);
  const feedback = useFeedback();
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [perms, setPerms] = useState<{ foreground: boolean; background: boolean } | null>(null);

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
        router.replace('/(app)/(tabs)/patrol/active');
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

      router.replace('/(app)/(tabs)/patrol/active');
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Could not start patrol');
    } finally {
      setStarting(false);
    }
  };

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  const needsPerms =
    perms && (!perms.foreground || (Platform.OS === 'android' && !perms.background));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 4 }}>
          Patrol
        </Text>
        <Text style={{ fontSize: 13, color: '#666666', marginBottom: 24 }}>
          Start a patrol to begin recording your route.
        </Text>

        {needsPerms ? (
          <View
            style={{
              backgroundColor: '#F5F5F5',
              borderLeftWidth: 4,
              borderLeftColor: '#000000',
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialIcons name="location-on" size={20} color="#000000" />
              <Text style={{ color: '#000000', fontWeight: '700', marginLeft: 8 }}>
                Location permission required
              </Text>
            </View>
            <Text style={{ color: '#333333', fontSize: 13, marginBottom: 12 }}>
              Patrols need background location to record the route while the phone is locked. On
              Android, choose &quot;Allow all the time&quot;.
            </Text>
            <TouchableOpacity
              onPress={requestPerms}
              activeOpacity={0.8}
              style={{
                backgroundColor: '#000000',
                borderRadius: 8,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.5 }}>
                GRANT PERMISSIONS
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: '#F5F5F5',
            borderRadius: 14,
            padding: 20,
            alignItems: 'center',
            marginTop: 12,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#000000',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <MaterialIcons name="directions-walk" size={40} color="#FFFFFF" />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111111', marginBottom: 4 }}>
            Ready to patrol
          </Text>
          <Text style={{ fontSize: 12, color: '#666666', textAlign: 'center', marginBottom: 16 }}>
            Your GPS path will be recorded every few seconds and uploaded automatically.
          </Text>

          <TouchableOpacity
            onPress={onStart}
            disabled={starting || !!needsPerms}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#000000',
              opacity: starting || needsPerms ? 0.6 : 1,
              borderRadius: 10,
              paddingVertical: 16,
              paddingHorizontal: 30,
              minHeight: 56,
              minWidth: 220,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
            }}
          >
            {starting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="play-arrow" size={22} color="#FFFFFF" />
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontWeight: '700',
                    fontSize: 15,
                    marginLeft: 6,
                    letterSpacing: 0.5,
                  }}
                >
                  START PATROL
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
