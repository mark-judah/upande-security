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
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useIncidentCategories } from '@/lib/hooks/useIncidentCategories';
import { useCreateIncident } from '@/lib/hooks/useCreateIncident';
import { uploadIncidentPhoto } from '@/lib/api/incidents';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { toFrappeDateTime } from '@/lib/utils/date';
import { Loader } from '@/components/ui/Loader';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#E8E8E8',
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} activeOpacity={0.6}>
          <MaterialIcons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text
          style={{ fontSize: 18, fontWeight: '700', color: '#000000', marginLeft: 12, flex: 1 }}
        >
          New Incident
        </Text>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
            extraScrollHeight={Platform.OS === 'ios' ? 20 : 40}
          >
            {/* 1. Date & Time */}
            <Text style={styles.label}>When did it happen? *</Text>
            <TouchableOpacity
              onPress={() => {
                setDatePickerMode('date');
                setShowDatePicker(true);
              }}
              activeOpacity={0.7}
              style={styles.pickerField}
            >
              <MaterialIcons name="schedule" size={18} color="#555555" />
              <Text style={{ marginLeft: 10, fontSize: 15, color: '#111111', flex: 1 }}>
                {incidentDate.toLocaleString()}
              </Text>
              <TouchableOpacity
                onPress={() => setIncidentDate(new Date())}
                hitSlop={8}
                activeOpacity={0.6}
              >
                <Text style={{ color: '#000000', fontSize: 12, fontWeight: '600' }}>NOW</Text>
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
            <Text style={styles.label}>Where? *</Text>
            <View style={styles.pickerField}>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. North gate, Warehouse B"
                placeholderTextColor="#A0A0A0"
                style={{ flex: 1, paddingVertical: 8, fontSize: 15, color: '#111111' }}
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
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <MaterialIcons name="my-location" size={20} color="#000000" />
                )}
              </TouchableOpacity>
            </View>

            {/* 3. Nature of incident */}
            <Text style={styles.label}>What kind of incident? *</Text>
            <TouchableOpacity
              onPress={() => setCategoryPickerOpen(true)}
              activeOpacity={0.7}
              style={styles.pickerField}
            >
              <MaterialIcons name="category" size={18} color="#555555" />
              <Text
                style={{
                  marginLeft: 10,
                  fontSize: 15,
                  color: nature ? '#111111' : '#A0A0A0',
                  flex: 1,
                }}
              >
                {nature || 'Select category'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={22} color="#666666" />
            </TouchableOpacity>

            {/* 4. Severity */}
            <Text style={styles.label}>Severity *</Text>
            <View style={{ flexDirection: 'row', marginBottom: 14 }}>
              {SEVERITIES.map((s) => {
                const selected = severity === s;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSeverity(s)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: '#000000',
                      backgroundColor: selected ? '#000000' : '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: s === 'Critical' ? 0 : 6,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? '#FFFFFF' : '#000000',
                        fontSize: 12,
                        fontWeight: '700',
                        letterSpacing: 0.5,
                      }}
                    >
                      {s.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 5. Description */}
            <Text style={styles.label}>What happened? *</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what you saw, in as much detail as possible"
              placeholderTextColor="#A0A0A0"
              multiline
              numberOfLines={5}
              style={{
                borderWidth: 1,
                borderColor: '#D0D0D0',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                minHeight: 120,
                textAlignVertical: 'top',
                fontSize: 15,
                color: '#111111',
                backgroundColor: '#FFFFFF',
                marginBottom: 14,
              }}
              editable={!busy}
            />

            {/* 6. Photos */}
            <Text style={styles.label}>Photos ({photos.length}/{MAX_PHOTOS})</Text>
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}
            >
              {photos.map((uri) => (
                <View
                  key={uri}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: '#E8E8E8',
                  }}
                >
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                  <TouchableOpacity
                    onPress={() => removePhoto(uri)}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      borderRadius: 999,
                      padding: 2,
                    }}
                    hitSlop={6}
                  >
                    <MaterialIcons name="close" size={14} color="#FFFFFF" />
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
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#D0D0D0',
                    borderStyle: 'dashed',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FAFAFA',
                  }}
                >
                  <MaterialIcons name="add-a-photo" size={24} color="#666666" />
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={onSubmit}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={{
                backgroundColor: '#000000',
                opacity: busy ? 0.6 : 1,
                borderRadius: 10,
                paddingVertical: 16,
                minHeight: 56,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                marginTop: 10,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="send" size={18} color="#FFFFFF" />
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontWeight: '700',
                      marginLeft: 8,
                      fontSize: 15,
                      letterSpacing: 0.5,
                    }}
                  >
                    SUBMIT REPORT
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </KeyboardAwareScrollView>
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
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              paddingHorizontal: 24,
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  maxHeight: 460,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    padding: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#E8E8E8',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111111' }}>
                    Nature of Incident
                  </Text>
                </View>
                {categoriesQuery.isLoading ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <ActivityIndicator color="#000000" />
                  </View>
                ) : (
                  <FlatList
                    data={categoriesQuery.data ?? []}
                    keyExtractor={(item) => item.name}
                    ItemSeparatorComponent={() => (
                      <View style={{ height: 1, backgroundColor: '#F0F0F0' }} />
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
                        <Text style={{ fontSize: 15, color: '#111111', flex: 1 }}>
                          {item.name}
                        </Text>
                        {nature === item.name ? (
                          <MaterialIcons name="check" size={18} color="#000000" />
                        ) : null}
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <Text style={{ color: '#666666', fontSize: 13 }}>
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

      {busy ? <Loader /> : null}
    </SafeAreaView>
  );
}

const styles = {
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#555555',
    marginBottom: 6,
    marginTop: 8,
  },
  pickerField: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
    minHeight: 44,
  },
};
