import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';
import { getActivePatrol, initPatrolDb } from '@/lib/services/patrolDb';
import { generatePatrolTag, sanitizeGuardCode } from '@/lib/services/patrolHelpers';
import { useFilePatrolReport } from '@/lib/hooks/useFilePatrolReport';
import { uploadPatrolPhoto } from '@/lib/api/patrol';
import { api } from '@/lib/services/api';
import { toFrappeDateTime } from '@/lib/utils/date';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { COLORS, borderRadius, fontSize, spacing } from '@/src/core/theme';
import type { IncidentSeverity, IncidentSummary, PatrolReportType } from '@/lib/services/api';

const REPORT_TYPES: PatrolReportType[] = ['Routine', 'Incident'];
const SEVERITIES: IncidentSeverity[] = ['Low', 'Medium', 'High', 'Critical'];
const NATURE_OPTIONS = [
  'Accident',
  'Fire',
  'Intrusion',
  'Medical Emergency',
  'Near Miss',
  'Other',
  'Property Damage',
  'Robbery With Violence',
  'SOS',
  'Theft',
];
const MAX_PHOTOS = 4;

export default function PatrolReportScreen() {
  const feedback = useFeedback();
  const userEmail = useAuthStore((s) => s.user?.email);
  const fileReport = useFilePatrolReport();

  const [ready, setReady] = useState(false);
  const [patrolTag, setPatrolTag] = useState('');
  const [isActivePatrol, setIsActivePatrol] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const [reportType, setReportType] = useState<PatrolReportType>('Routine');
  const [observations, setObservations] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('Medium');
  const [nature, setNature] = useState('');
  const [naturePickerOpen, setNaturePickerOpen] = useState(false);

  const [linkedIncident, setLinkedIncident] = useState<string | null>(null);
  const [incidentPickerOpen, setIncidentPickerOpen] = useState(false);
  const [myIncidents, setMyIncidents] = useState<IncidentSummary[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);

  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      await initPatrolDb();
      const active = await getActivePatrol();
      if (active && !active.stoppedAt) {
        setPatrolTag(active.patrolTag);
        setIsActivePatrol(true);
        setStartedAt(active.startedAt);
      } else {
        // No active GPS session — file a standalone observation with a
        // freshly generated tag. The server doesn't require it to match a
        // real Patrol GPS Log group; `patrol` is just this report's own key.
        const code = sanitizeGuardCode(userEmail || 'GUARD');
        setPatrolTag(generatePatrolTag('ADHOC-' + code));
        setIsActivePatrol(false);
        setStartedAt(toFrappeDateTime());
      }
      setReady(true);
    })().catch(() => setReady(true));
  }, [userEmail]);

  const openIncidentPicker = async () => {
    setIncidentPickerOpen(true);
    if (myIncidents.length === 0) {
      setIncidentsLoading(true);
      try {
        const rows = await api.myIncidents();
        setMyIncidents(rows);
      } catch (e) {
        feedback.error(e instanceof Error ? e.message : 'Could not load incidents');
      } finally {
        setIncidentsLoading(false);
      }
    }
  };

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      feedback.warning(`Maximum ${MAX_PHOTOS} photos`);
      return;
    }
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Take Photo',
        onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
          if (!r.canceled && r.assets[0]) setPhotos((p) => [...p, r.assets[0].uri]);
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            mediaTypes: ['images'],
            allowsEditing: false,
          });
          if (!r.canceled && r.assets[0]) setPhotos((p) => [...p, r.assets[0].uri]);
        },
      },
    ]);
  };

  const removePhoto = (uri: string) => setPhotos((p) => p.filter((x) => x !== uri));

  const onSubmit = async () => {
    Keyboard.dismiss();
    if (!observations.trim()) {
      feedback.warning('Observations are required');
      return;
    }
    if (reportType === 'Incident' && !nature) {
      feedback.warning('Pick a nature of incident');
      return;
    }

    try {
      setUploading(true);
      const uploaded: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const name = `patrol_${Date.now()}_${i}.jpg`;
        uploaded.push(await uploadPatrolPhoto(photos[i], name));
      }

      await fileReport.mutateAsync({
        patrol: patrolTag,
        report_type: reportType,
        observations: observations.trim(),
        started_at: startedAt || undefined,
        ended_at: isActivePatrol ? undefined : toFrappeDateTime(),
        severity: reportType === 'Incident' ? severity : undefined,
        nature_of_incident: reportType === 'Incident' ? nature : undefined,
        incident_report: reportType === 'Incident' ? linkedIncident || undefined : undefined,
        attachment_1: uploaded[0],
        attachment_2: uploaded[1],
        attachment_3: uploaded[2],
        attachment_4: uploaded[3],
      });

      router.back();
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setUploading(false);
    }
  };

  const busy = uploading || fileReport.isPending;

  return (
    <Screen
      title="Patrol Report"
      loading={!ready}
      footer={
        <Button
          label="SUBMIT REPORT"
          iconLeft="send"
          onPress={onSubmit}
          disabled={busy}
          loading={busy}
        />
      }
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View>
          {/* Patrol context */}
          <View style={s.contextCard}>
            <Ionicons
              name={isActivePatrol ? 'walk' : 'create-outline'}
              size={18}
              color={COLORS.textMuted}
            />
            <View style={{ marginLeft: spacing.sm + 2, flex: 1 }}>
              <Text style={s.contextTitle}>
                {isActivePatrol ? 'Filing against active patrol' : 'Standalone observation'}
              </Text>
              <Text style={s.contextTag}>{patrolTag}</Text>
            </View>
          </View>

          {/* Report type */}
          <Text style={s.label}>Report Type *</Text>
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            {REPORT_TYPES.map((t) => {
              const selected = reportType === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setReportType(t)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm + 2,
                    borderWidth: 1,
                    borderColor: COLORS.text,
                    backgroundColor: selected ? COLORS.text : COLORS.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: t === 'Incident' ? 0 : 6,
                    borderRadius: borderRadius.md,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? COLORS.bg : COLORS.text,
                      fontSize: fontSize.xs,
                      fontWeight: '700',
                      letterSpacing: 0.5,
                    }}
                  >
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Observations */}
          <Text style={s.label}>What did you observe? *</Text>
          <TextInput
            value={observations}
            onChangeText={setObservations}
            placeholder="Describe what you saw during the patrol"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={5}
            style={s.textArea}
            editable={!busy}
          />

          {reportType === 'Incident' ? (
            <>
              {/* Severity */}
              <Text style={s.label}>Severity *</Text>
              <View style={{ flexDirection: 'row', marginBottom: 14 }}>
                {SEVERITIES.map((sev) => {
                  const selected = severity === sev;
                  return (
                    <TouchableOpacity
                      key={sev}
                      onPress={() => setSeverity(sev)}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.sm + 2,
                        borderWidth: 1,
                        borderColor: COLORS.text,
                        backgroundColor: selected ? COLORS.text : COLORS.bg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: sev === 'Critical' ? 0 : 6,
                        borderRadius: borderRadius.md,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? COLORS.bg : COLORS.text,
                          fontSize: fontSize.xs,
                          fontWeight: '700',
                          letterSpacing: 0.5,
                        }}
                      >
                        {sev.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Nature of incident */}
              <Text style={s.label}>Nature of Incident *</Text>
              <TouchableOpacity
                onPress={() => setNaturePickerOpen(true)}
                activeOpacity={0.7}
                style={s.pickerField}
              >
                <Ionicons name="list-outline" size={18} color={COLORS.textMuted} />
                <Text
                  style={{
                    marginLeft: spacing.sm + 2,
                    fontSize: fontSize.md,
                    color: nature ? COLORS.text : COLORS.textMuted,
                    flex: 1,
                  }}
                >
                  {nature || 'Select category'}
                </Text>
                <Ionicons name="chevron-down" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>

              {/* Optional link to an existing Incident Report */}
              <Text style={s.label}>Link an Incident Report (optional)</Text>
              <TouchableOpacity onPress={openIncidentPicker} activeOpacity={0.7} style={s.pickerField}>
                <Ionicons name="link-outline" size={18} color={COLORS.textMuted} />
                <Text
                  style={{
                    marginLeft: spacing.sm + 2,
                    fontSize: fontSize.md,
                    color: linkedIncident ? COLORS.text : COLORS.textMuted,
                    flex: 1,
                  }}
                >
                  {linkedIncident || 'None selected'}
                </Text>
                {linkedIncident ? (
                  <TouchableOpacity onPress={() => setLinkedIncident(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-down" size={22} color={COLORS.textMuted} />
                )}
              </TouchableOpacity>
            </>
          ) : null}

          {/* Photos */}
          <Text style={s.label}>
            Photos ({photos.length}/{MAX_PHOTOS})
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 14 }}>
            {photos.map((uri) => (
              <View key={uri} style={s.photoThumb}>
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                <TouchableOpacity onPress={() => removePhoto(uri)} style={s.photoRemove} hitSlop={6}>
                  <Ionicons name="close" size={14} color={COLORS.bg} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <TouchableOpacity onPress={pickPhoto} activeOpacity={0.7} style={s.photoAdd}>
                <Ionicons name="camera-outline" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Nature of incident picker */}
      <Modal
        visible={naturePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNaturePickerOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setNaturePickerOpen(false)}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.modalCard}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Nature of Incident</Text>
                </View>
                <FlatList
                  data={NATURE_OPTIONS}
                  keyExtractor={(item) => item}
                  ItemSeparatorComponent={() => <View style={s.sep} />}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        setNature(item);
                        setNaturePickerOpen(false);
                      }}
                      activeOpacity={0.6}
                      style={s.modalRow}
                    >
                      <Text style={{ fontSize: fontSize.md, color: COLORS.text, flex: 1 }}>{item}</Text>
                      {nature === item ? (
                        <Ionicons name="checkmark" size={18} color={COLORS.text} />
                      ) : null}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Existing incident picker */}
      <Modal
        visible={incidentPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIncidentPickerOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIncidentPickerOpen(false)}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.modalCard}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Your Incident Reports</Text>
                </View>
                {incidentsLoading ? (
                  <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                    <ActivityIndicator color={COLORS.text} />
                  </View>
                ) : (
                  <FlatList
                    data={myIncidents}
                    keyExtractor={(item) => item.name}
                    ItemSeparatorComponent={() => <View style={s.sep} />}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          setLinkedIncident(item.name);
                          setIncidentPickerOpen(false);
                        }}
                        activeOpacity={0.6}
                        style={s.modalRow}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: fontSize.md, color: COLORS.text, fontWeight: '600' }}>
                            {item.name}
                          </Text>
                          <Text style={{ fontSize: fontSize.xs, color: COLORS.textMuted }}>
                            {item.nature_of_incident} · {item.location}
                          </Text>
                        </View>
                        {linkedIncident === item.name ? (
                          <Ionicons name="checkmark" size={18} color={COLORS.text} />
                        ) : null}
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                        <Text style={{ color: COLORS.textMuted, fontSize: fontSize.sm }}>
                          You haven&apos;t filed any incidents yet
                        </Text>
                      </View>
                    }
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}

const s = {
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600' as const,
    color: COLORS.textMuted,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  pickerField: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: COLORS.bg,
    marginBottom: 14,
    minHeight: 44,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 120,
    textAlignVertical: 'top' as const,
    fontSize: fontSize.md,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
    marginBottom: 14,
  },
  contextCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: COLORS.bgMuted,
    marginBottom: spacing.md,
  },
  contextTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  contextTag: {
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoRemove: {
    position: 'absolute' as const,
    top: 2,
    right: 2,
    backgroundColor: COLORS.overlay,
    borderRadius: borderRadius.full,
    padding: 2,
  },
  photoAdd: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: COLORS.bgMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    backgroundColor: COLORS.bg,
    borderRadius: borderRadius.lg,
    maxHeight: 460,
    overflow: 'hidden' as const,
  },
  modalHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: fontSize.md,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  modalRow: {
    padding: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  sep: {
    height: 1,
    backgroundColor: COLORS.bgMuted,
  },
};
