import { useEffect } from 'react';
import { View, Text, StyleSheet, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SosLocationMap } from '@/components/sos/SosLocationMap';
import { Button } from '@/src/core/ui/Button';
import { COLORS, fontFamily, fontSize, spacing, borderRadius } from '@/src/core/theme';

/**
 * Full-screen "another guard's SOS" alert. Reached either by a real push
 * notification tap (see lib/services/nearbyAlert.ts) or, while the app is
 * already foregrounded, automatically as soon as the push is received.
 *
 * v1 is a courtesy UI only — "I'm responding" / "Dismiss" both just leave
 * the screen. There is no two-way acknowledgement sent to the server.
 */
export default function SosAlertScreen() {
  const params = useLocalSearchParams<{
    guard_name?: string;
    latitude?: string;
    longitude?: string;
    incident_name?: string;
    distance_m?: string;
  }>();

  const guardName = params.guard_name || 'A guard';
  const incidentName = params.incident_name || '';
  const lat = params.latitude ? Number(params.latitude) : null;
  const lng = params.longitude ? Number(params.longitude) : null;
  const distanceM = params.distance_m ? Number(params.distance_m) : null;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    // Block the Android hardware back button from silently dismissing a
    // live SOS — route the guard through the explicit Dismiss action.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const distanceLabel =
    distanceM != null && !Number.isNaN(distanceM) ? Math.round(distanceM) + 'm away' : null;

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={s.header}>
          <View style={s.iconBadge}>
            <Ionicons name="alert-circle" size={40} color={COLORS.textOnPrimary} />
          </View>
          <Text style={s.title}>SOS — {guardName} needs help</Text>
          {distanceLabel ? <Text style={s.subtitle}>{distanceLabel}</Text> : null}
          {incidentName ? <Text style={s.incident}>Incident: {incidentName}</Text> : null}
        </View>

        <View style={s.mapWrap}>
          <SosLocationMap lat={lat} lng={lng} label={`${guardName} — SOS`} />
        </View>

        <View style={s.actions}>
          <Button label="I'm responding" iconLeft="walk-outline" onPress={close} />
          <Button
            label="Dismiss"
            variant="outline"
            iconLeft="close-outline"
            color={COLORS.textOnPrimary}
            style={s.dismissBtn}
            onPress={close}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.danger },
  safe: { flex: 1, justifyContent: 'space-between', padding: spacing.lg },
  header: { alignItems: 'center', marginTop: spacing.lg, gap: spacing.xs },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    color: COLORS.textOnPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: COLORS.textOnPrimary,
  },
  incident: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  mapWrap: { marginVertical: spacing.lg },
  actions: { gap: spacing.md },
  dismissBtn: { borderColor: COLORS.textOnPrimary },
});
