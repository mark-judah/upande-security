import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useGateStore } from '@/lib/stores/gateStore';
import { usePipelinePoints, useScanPipelinePoint } from '@/lib/hooks/usePipeline';
import { useFeatureFlagOn } from '@/lib/hooks/useSessionInfo';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { uploadIncidentPhoto } from '@/lib/api/incidents';
import { bestFix, type GpsFix } from '@/lib/utils/gps';
import { fmtDateTime } from '@/lib/utils/date';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { Card } from '@/src/core/ui/Card';
import { COLORS, spacing, fontFamily, fontSize, radius } from '@/src/core/theme';
import type { PipelineCondition, PipelineLine, ScanPipelineResult } from '@/lib/services/api';

const CONDITIONS: PipelineCondition[] = ['OK', 'Leak', 'Damaged', 'Valve Issue', 'Blocked', 'Other'];

/** CP-00012 out of the label URL (or a bare name) - only used to show the
 * point's name before the server answers; the server resolves it itself. */
function pointFromCode(raw: string): string {
  const m = raw.match(/\/(?:app|desk)\/security-checkpoint\/([^?#/]+)/);
  return decodeURIComponent(m ? m[1] : raw).trim();
}

/** Pipeline Trace: walk a water pipeline and scan the QR at each point.
 *
 * The GPS fix is taken straight after the scan, while the guard is standing
 * at the point (the server only accepts a scan inside the point's fence);
 * then the guard records the condition, a note and an optional photo. Each
 * accepted scan is an Asset Scan Log row of type Pipeline. */
export default function PipelineTrace() {
  const enabled = useFeatureFlagOn('feature_pipeline_trace');
  const feedback = useFeedback();
  const lines = usePipelinePoints(enabled);
  const scan = useScanPipelinePoint();
  const pending = useGateStore((s) => s.pendingScannedPipeline);
  const setPending = useGateStore((s) => s.setPendingScannedPipeline);

  const [locating, setLocating] = useState<number | null | undefined>(undefined);
  const [draft, setDraft] = useState<{ code: string; fix: GpsFix } | null>(null);
  const [condition, setCondition] = useState<PipelineCondition>('OK');
  const [remarks, setRemarks] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [last, setLast] = useState<ScanPipelineResult | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const names = useMemo(() => {
    const m: Record<string, string> = {};
    (lines.data ?? []).forEach((l) => l.points.forEach((p) => (m[p.checkpoint] = p.checkpoint_name)));
    return m;
  }, [lines.data]);

  useEffect(() => {
    if (lines.data && lines.data.length === 1 && open === null) setOpen(lines.data[0].pipeline);
  }, [lines.data, open]);

  useEffect(() => {
    if (!pending) return;
    const code = pending;
    setPending(null);
    setLast(null);
    (async () => {
      setLocating(null);
      try {
        const fix = await bestFix({ onUpdate: (acc) => setLocating(acc) });
        if (!fix) {
          feedback.warning('Location permission is needed to record a pipeline point');
          return;
        }
        setCondition('OK');
        setRemarks('');
        setPhoto(null);
        setDraft({ code, fix });
      } finally {
        setLocating(undefined);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera', 'Camera permission is needed to add a photo.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
    if (!r.canceled && r.assets[0]) setPhoto(r.assets[0].uri);
  };

  const save = async () => {
    if (!draft) return;
    let photoUrl: string | undefined;
    try {
      if (photo) {
        setUploading(true);
        photoUrl = await uploadIncidentPhoto(photo, `pipeline-${Date.now()}.jpg`);
      }
    } catch {
      feedback.error('Could not upload the photo - try again, or save without it');
      setUploading(false);
      return;
    }
    setUploading(false);
    try {
      const result = await scan.mutateAsync({
        code: draft.code,
        latitude: draft.fix.latitude,
        longitude: draft.fix.longitude,
        accuracy: draft.fix.accuracy,
        mocked: draft.fix.mocked ? 1 : 0,
        condition,
        remarks: remarks.trim() || undefined,
        photo: photoUrl,
      });
      setLast(result);
      if (result.pipeline) setOpen(result.pipeline.pipeline);
      setDraft(null);
    } catch {
      // useScanPipelinePoint already shows the error; keep the draft to retry
    }
  };

  if (!enabled) {
    return (
      <Screen title="Pipeline Trace">
        <Card style={s.center}>
          <Ionicons name="water-outline" size={32} color={COLORS.textMuted} />
          <Text style={s.muted}>Pipeline Trace is not enabled on this site.</Text>
          <Button label="BACK" variant="outline" onPress={() => router.back()} style={s.topGap} />
        </Card>
      </Screen>
    );
  }

  const busy = locating !== undefined || uploading || scan.isPending;

  return (
    <Screen
      title="Pipeline Trace"
      loading={lines.isLoading}
      error={lines.error ? (lines.error as Error).message : null}
      onRetry={() => lines.refetch()}
      onRefresh={async () => {
        await lines.refetch();
      }}
    >
      {!draft ? (
        <Button
          label="SCAN PIPELINE POINT"
          iconLeft="qr-code-outline"
          onPress={() => router.push('/scan?intent=pipeline')}
          loading={locating !== undefined}
          disabled={busy}
        />
      ) : null}

      {locating !== undefined ? (
        <Card style={StyleSheet.flatten([s.resultCard, s.center])}>
          <ActivityIndicator color={COLORS.text} />
          <Text style={s.muted}>
            Getting a precise GPS fix{locating ? ` (±${Math.round(locating)} m)` : ''}… stand at the point
          </Text>
        </Card>
      ) : null}

      {draft ? (
        <Card style={s.resultCard}>
          <Text style={s.label}>POINT</Text>
          <Text style={s.itemTitle}>{names[pointFromCode(draft.code)] ?? pointFromCode(draft.code)}</Text>
          <Text style={s.itemSub}>
            GPS ±{draft.fix.accuracy ? Math.round(draft.fix.accuracy) : '?'} m
          </Text>

          <Text style={[s.label, s.topGap]}>CONDITION</Text>
          <View style={s.chips}>
            {CONDITIONS.map((c) => {
              const on = c === condition;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCondition(c)}
                  style={[s.chip, on && (c === 'OK' ? s.chipOk : s.chipIssue)]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[s.label, s.topGap]}>NOTE {condition === 'OK' ? '(optional)' : ''}</Text>
          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            placeholder={condition === 'OK' ? 'Anything to report' : 'What did you see?'}
            placeholderTextColor={COLORS.textMuted}
            multiline
            style={s.input}
          />

          <View style={[s.row, s.topGap]}>
            {photo ? <Image source={{ uri: photo }} style={s.thumb} /> : null}
            <Button
              label={photo ? 'RETAKE PHOTO' : 'ADD PHOTO'}
              iconLeft="camera-outline"
              variant="outline"
              onPress={takePhoto}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </View>

          <Button
            label={uploading ? 'UPLOADING PHOTO…' : 'SAVE'}
            iconLeft="checkmark"
            onPress={save}
            loading={uploading || scan.isPending}
            disabled={busy}
            style={s.topGap}
          />
          <Button label="CANCEL" variant="ghost" onPress={() => setDraft(null)} disabled={busy} />
        </Card>
      ) : null}

      {last && !draft ? (
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

      {lines.data && lines.data.length === 0 ? (
        <Card style={StyleSheet.flatten([s.topGap, s.center])}>
          <Ionicons name="water-outline" size={28} color={COLORS.textMuted} />
          <Text style={s.muted}>No pipeline points are set up for your farm yet. Ask your supervisor.</Text>
        </Card>
      ) : null}

      {(lines.data ?? []).map((l: PipelineLine) => {
        const expanded = open === l.pipeline;
        return (
          <View key={l.pipeline} style={s.topGap}>
            <TouchableOpacity onPress={() => setOpen(expanded ? '' : l.pipeline)} activeOpacity={0.8}>
              <Card style={s.lineCard}>
                <Ionicons name="water" size={20} color={COLORS.info} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={s.itemTitle}>{l.pipeline}</Text>
                  <Text style={s.itemSub}>
                    {l.done_today} / {l.total} today{l.farms.length ? ` · ${l.farms.join(', ')}` : ''}
                    {l.issues ? ` · ${l.issues} issue${l.issues === 1 ? '' : 's'}` : ''}
                  </Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} />
              </Card>
            </TouchableOpacity>
            {expanded
              ? l.points.map((p, i) => {
                  const issue = p.last_condition && p.last_condition !== 'OK';
                  return (
                    <Card key={p.checkpoint} style={s.item}>
                      <View style={[s.badge, p.scanned_today ? (issue ? s.badgeIssue : s.badgeDone) : null]}>
                        {p.scanned_today ? (
                          <Ionicons name={issue ? 'alert' : 'checkmark'} size={16} color={COLORS.textOnPrimary} />
                        ) : (
                          <Text style={s.badgeText}>{p.sequence ?? i + 1}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle}>{p.checkpoint_name}</Text>
                        <Text style={s.itemSub}>
                          {p.last_scanned_at
                            ? `${p.last_condition ?? ''} · ${fmtDateTime(p.last_scanned_at)}`
                            : p.has_position
                              ? 'Not scanned yet'
                              : 'Position not set'}
                        </Text>
                        {p.location_hint ? <Text style={s.itemSub}>{p.location_hint}</Text> : null}
                      </View>
                    </Card>
                  );
                })
              : null}
          </View>
        );
      })}
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
  topGap: { marginTop: spacing.md },
  label: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs, color: COLORS.textMuted, letterSpacing: 0.8 },
  resultCard: { marginTop: spacing.md, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resultTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text, marginLeft: spacing.sm },
  resultMsg: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textSecondary, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipOk: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  chipIssue: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  chipText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text },
  chipTextOn: { color: COLORS.textOnPrimary },
  input: {
    marginTop: spacing.sm,
    minHeight: 64,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
  thumb: { width: 56, height: 56, borderRadius: radius.md },
  lineCard: { flexDirection: 'row', alignItems: 'center' },
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
  badgeIssue: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  badgeText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs, color: COLORS.textSecondary },
  itemTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text },
  itemSub: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted, marginTop: 2 },
});
