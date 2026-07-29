import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useIncidentCategories } from '@/lib/hooks/useIncidentCategories';
import { useCreateIncident } from '@/lib/hooks/useCreateIncident';
import { uploadIncidentPhoto } from '@/lib/api/incidents';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { toFrappeDateTime } from '@/lib/utils/date';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { COLORS, borderRadius, fontSize, spacing } from '@/src/core/theme';
import type { IncidentSeverity } from '@/lib/api/types';

const SEVERITIES: IncidentSeverity[] = ['Low', 'Medium', 'High', 'Critical'];
const MAX_PHOTOS = 4;

export default function NewIncident() {
  const feedback = useFeedback();
  const [incidentDate, setIncidentDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');

  const [location, setLocation] = useState('');
  const [locating, setLocating] = useState(false);

  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [nature, setNature] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('Medium');
  const [description, setDescription] = useState('');

  const [photos, setPhotos] = useState<string[]>([]); // local URIs
  const [uploading, setUploading] = useState(false);

  const categoriesQuery = useIncidentCategories();
  const createIncident = useCreateIncident();

  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      await ImagePicker.requestCameraPermissionsAsync();
    })();
  }, []);

  const onUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        feedback.warning('Location permission denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      setLocation((prev) => {
        const coords = `${lat}, ${lng}`;
        return prev ? `${prev} · ${coords}` : coords;
      });
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Could not get location');
    } finally {
      setLocating(false);
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
          const r = await ImagePicker.launchCameraAsync({
            quality: 0.7,
            allowsEditing: false,
          });
          if (!r.canceled && r.assets[0]) {
            setPhotos((p) => [...p, r.assets[0].uri]);
          }
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
          if (!r.canceled && r.assets[0]) {
            setPhotos((p) => [...p, r.assets[0].uri]);
          }
        },
      },
    ]);
  };

  const removePhoto = (uri: string) => {
    setPhotos((p) => p.filter((x) => x !== uri));
  };

  const onSubmit = async () => {
    Keyboard.dismiss();
    if (!location.trim()) {
      feedback.warning('Location is required');
      return;
    }
    if (!nature) {
      feedback.warning('Pick a nature of incident');
      return;
    }
    if (!description.trim()) {
      feedback.warning('Description is required');
      return;
    }

    try {
      setUploading(true);
      const uploaded: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const uri = photos[i];
        const name = `incident_${Date.now()}_${i}.jpg`;
        const url = await uploadIncidentPhoto(uri, name);
        uploaded.push(url);
      }

      await createIncident.mutateAsync({
        incident_datetime: toFrappeDateTime(incidentDate),
        location: location.trim(),
        nature_of_incident: nature,
        severity,
        description: description.trim(),
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

  const onDateChange = (event: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (d) setIncidentDate(d);
    if (Platform.OS === 'android' && datePickerMode === 'date') {
      setDatePickerMode('time');
      setShowDatePicker(true);
    }
  };

  const busy = uploading || createIncident.isPending;

  return (
    <Screen
      title="New Incident"
      loading={busy}
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
          {/* 1. Date & Time */}
          <Text style={s.label}>When did it happen? *</Text>
          <TouchableOpacity
            onPress={() => {
              setDatePickerMode('date');
              setShowDatePicker(true);
            }}
            activeOpacity={0.7}
            style={s.pickerField}
          >
            <Ionicons name="time-outline" size={18} color={COLORS.textMuted} />
            <Text style={{ marginLeft: spacing.sm + 2, fontSize: fontSize.md, color: COLORS.text, flex: 1 }}>
              {incidentDate.toLocaleString()}
            </Text>
            <TouchableOpacity
              onPress={() => setIncidentDate(new Date())}
              hitSlop={8}
              activeOpacity={0.6}
            >
              <Text style={{ color: COLORS.text, fontSize: fontSize.xs, fontWeight: '600' }}>NOW</Text>
            </TouchableOpacity>
          </TouchableOpacity>
          {showDatePicker ? (
            <DateTimePicker
              value={incidentDate}
              mode={datePickerMode}
              is24Hour
              onChange={onDateChange}
            />
          ) : null}

          {/* 2. Location */}
          <Text style={s.label}>Where? *</Text>
          <View style={s.pickerField}>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. North gate, Warehouse B"
              placeholderTextColor={COLORS.textMuted}
              style={{ flex: 1, paddingVertical: spacing.sm, fontSize: fontSize.md, color: COLORS.text }}
              editable={!busy}
            />
            <TouchableOpacity
              onPress={onUseCurrentLocation}
              disabled={locating || busy}
              hitSlop={8}
              activeOpacity={0.6}
              accessibilityLabel="Use current location"
            >
              {locating ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Ionicons name="location-outline" size={20} color={COLORS.text} />
              )}
            </TouchableOpacity>
          </View>

          {/* 3. Nature of incident */}
          <Text style={s.label}>What kind of incident? *</Text>
          <TouchableOpacity
            onPress={() => setCategoryPickerOpen(true)}
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

          {/* 4. Severity */}
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

          {/* 5. Description */}
          <Text style={s.label}>What happened? *</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe what you saw, in as much detail as possible"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={5}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              minHeight: 120,
              textAlignVertical: 'top',
              fontSize: fontSize.md,
              color: COLORS.text,
              backgroundColor: COLORS.bg,
              marginBottom: 14,
            }}
            editable={!busy}
          />

          {/* 6. Photos */}
          <Text style={s.label}>Photos ({photos.length}/{MAX_PHOTOS})</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 14 }}>
            {photos.map((uri) => (
              <View
                key={uri}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: borderRadius.md,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                <TouchableOpacity
                  onPress={() => removePhoto(uri)}
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    backgroundColor: COLORS.overlay,
                    borderRadius: borderRadius.full,
                    padding: 2,
                  }}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={14} color={COLORS.bg} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <TouchableOpacity
                onPress={pickPhoto}
                activeOpacity={0.7}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderStyle: 'dashed',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.bgMuted,
                }}
              >
                <Ionicons name="camera-outline" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Category picker */}
      <Modal
        visible={categoryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCategoryPickerOpen(false)}>
          <View
            style={{
              flex: 1,
              backgroundColor: COLORS.overlay,
              justifyContent: 'center',
              paddingHorizontal: spacing.xl,
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: COLORS.bg,
                  borderRadius: borderRadius.lg,
                  maxHeight: 460,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    padding: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.border,
                  }}
                >
                  <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: COLORS.text }}>
                    Nature of Incident
                  </Text>
                </View>
                {categoriesQuery.isLoading ? (
                  <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                    <ActivityIndicator color={COLORS.text} />
                  </View>
                ) : (
                  <FlatList
                    data={categoriesQuery.data ?? []}
                    keyExtractor={(item) => item.name}
                    ItemSeparatorComponent={() => (
                      <View style={{ height: 1, backgroundColor: COLORS.bgMuted }} />
                    )}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          setNature(item.name);
                          setCategoryPickerOpen(false);
                        }}
                        activeOpacity={0.6}
                        style={{
                          padding: 14,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: fontSize.md, color: COLORS.text, flex: 1 }}>
                          {item.name}
                        </Text>
                        {nature === item.name ? (
                          <Ionicons name="checkmark" size={18} color={COLORS.text} />
                        ) : null}
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                        <Text style={{ color: COLORS.textMuted, fontSize: fontSize.sm }}>
                          No categories configured
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
};
