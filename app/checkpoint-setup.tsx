import { useEffect, useState } from 'react';
import { View, Text, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useGateStore } from '@/lib/stores/gateStore';
import { useCheckpointsForSetup, useSetCheckpointPosition } from '@/lib/hooks/useCheckpoints';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { collectReadings, type GpsFix } from '@/lib/utils/gps';
import { fmtDateTime } from '@/lib/utils/date';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { Card } from '@/src/core/ui/Card';
import { COLORS, spacing, fontFamily, fontSize } from '@/src/core/theme';

const READINGS = 10;

/** System Manager / Security Head: set each checkpoint's position by
 * standing at it. A checkpoint's fence is a few metres, which a typed or
 * map-picked position cannot meet, so the phone collects a run of readings
 * and the server averages them (sharper readings weigh more). */
export default function CheckpointSetup() {
  const feedback = useFeedback();
  const list = useCheckpointsForSetup();
  const save = useSetCheckpointPosition();
  const pending = useGateStore((s) => s.pendingScannedCheckpointSetup);
  const setPending = useGateStore((s) => s.setPendingScannedCheckpointSetup);
  const [readings, setReadings] = useState<GpsFix[] | null>(null);

  useEffect(() => {
    if (!pending) return;
    const code = pending;
    setPending(null);
    Alert.alert(
      'Set checkpoint position?',
      'Stand right at the QR label and keep still until the readings finish (up to 30 seconds).',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => measure(code) },
      ],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const measure = async (code: string) => {
    setReadings([]);
    try {
      const got = await collectReadings({ count: READINGS, onUpdate: setReadings });
      if (!got) {
        feedback.warning('Location permission is needed to set a position');
        return;
      }
      await save.mutateAsync({
        code,
        readings: got.readings.map(({ latitude, longitude, accuracy }) => ({ latitude, longitude, accuracy })),
        mocked: got.mocked ? 1 : 0,
      });
    } catch {
      // useSetCheckpointPosition already shows the error
    } finally {
      setReadings(null);
    }
  };

  const busy = readings !== null || save.isPending;
  const best = readings?.reduce<number | null>(
    (m, r) => (r.accuracy !== null && (m === null || r.accuracy < m) ? r.accuracy : m),
    null,
  );
  const items = list.data ?? [];
  const missing = items.filter((c) => !c.has_position).length;

  return (
    <Screen title="Set Checkpoint Positions" loading={list.isLoading}>
      <Text style={s.intro}>
        Stand at each checkpoint, scan its QR and keep still while the phone takes {READINGS} GPS
        readings. Guards can only scan a checkpoint once its position is set.
      </Text>

      <Button
        label="SCAN & SET POSITION"
        iconLeft="locate-outline"
        onPress={() => router.push('/scan?intent=checkpointSetup')}
        loading={busy}
        disabled={busy}
      />

      {readings !== null ? (
        <Card style={StyleSheet.flatten([s.topGap, s.center])}>
          <ActivityIndicator color={COLORS.text} />
          <Text style={s.muted}>
            {save.isPending
              ? 'Saving…'
              : `Reading ${readings.length} / ${READINGS}${best !== null && best !== undefined ? ` · best ±${Math.round(best)} m` : ''} - keep still`}
          </Text>
        </Card>
      ) : null}

      <Text style={s.section}>
        {items.length} checkpoint{items.length === 1 ? '' : 's'}
        {missing ? ` · ${missing} without a position` : ''}
      </Text>

      {items.map((c) => (
        <Card key={c.checkpoint} style={s.item}>
          <Ionicons
            name={c.has_position ? 'location' : 'location-outline'}
            size={20}
            color={c.has_position ? COLORS.success : COLORS.warn}
            style={{ marginRight: spacing.md }}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.itemTitle}>{c.checkpoint_name}</Text>
            <Text style={s.itemSub}>
              {c.checkpoint}
              {c.farm ? ` · ${c.farm}` : ''}
              {c.has_position
                ? ` · ±${c.position_accuracy_m ?? '?'} m${c.position_set_at ? `, ${fmtDateTime(c.position_set_at)}` : ''}`
                : ' · position not set'}
            </Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: COLORS.textMuted,
    marginBottom: spacing.lg,
  },
  topGap: { marginTop: spacing.md },
  center: { alignItems: 'center' },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  section: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  item: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  itemTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text },
  itemSub: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
});
