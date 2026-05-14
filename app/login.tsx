import { FormInput } from '@/components/forms/FormInput';
import { Loader } from '@/components/ui/Loader';
import { useAuthStore } from '@/lib/stores/authStore';
import { MaterialIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

const schema = z.object({
  email: z.string().trim().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Instance URL is hidden from the main form. Stored separately, edited via
  // a long-press on the logo.
  const [instanceUrl, setInstanceUrl] = useState('');
  const [urlLoaded, setUrlLoaded] = useState(false);
  const [configVisible, setConfigVisible] = useState(false);
  const [configDraft, setConfigDraft] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    (async () => {
      const stored = (await AsyncStorage.getItem('instanceurl')) ?? '';
      setInstanceUrl(stored);
      setUrlLoaded(true);
      // Auto-open the config dialog if the URL has never been set
      if (!stored) setConfigVisible(true);
    })();
  }, []);

  const openConfig = () => {
    setConfigDraft(instanceUrl);
    setConfigVisible(true);
  };

  const saveConfig = async () => {
    const url = configDraft.trim();
    if (!url) {
      setConfigVisible(false);
      return;
    }
    await AsyncStorage.setItem('instanceurl', url);
    setInstanceUrl(url);
    setConfigVisible(false);
  };

  const onSubmit = async (values: FormValues) => {
    if (!instanceUrl) {
      setSubmitError('Instance URL not configured. Long-press the logo.');
      setConfigVisible(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await login(instanceUrl, values.email, values.password);
      router.replace('/(app)/(tabs)/gate');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!urlLoaded) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
            extraScrollHeight={Platform.OS === 'ios' ? 20 : 40}
            enableAutomaticScroll
            showsVerticalScrollIndicator={false}
          >
            <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 24 }}>
              <View style={{ alignItems: 'center', marginBottom: 28 }}>
                <Pressable onLongPress={openConfig} delayLongPress={1200} hitSlop={16}>
                  <Image
                    source={require('../assets/images/upande_logo.png')}
                    style={{ width: 180, height: 180, marginBottom: 8 }}
                    resizeMode="contain"
                  />
                </Pressable>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#000000' }}>
                  Upande Security
                </Text>
                <Text style={{ color: '#666666', marginTop: 4 }}>Sign in to continue</Text>
              </View>

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <FormInput
                    label="Email"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!submitting}
                    error={errors.email?.message}
                  />
                )}
              />

              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#555555', marginBottom: 4 }}>Password</Text>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: errors.password ? '#000000' : '#D0D0D0',
                        borderRadius: 8,
                        backgroundColor: '#FFFFFF',
                        paddingLeft: 12,
                        paddingRight: 8,
                      }}
                    >
                      <TextInput
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="••••••••"
                        placeholderTextColor="#A0A0A0"
                        secureTextEntry={!showPassword}
                        editable={!submitting}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          fontSize: 15,
                          color: '#111111',
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((v) => !v)}
                        hitSlop={8}
                        activeOpacity={0.6}
                        style={{ padding: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <MaterialIcons
                          name={showPassword ? 'visibility-off' : 'visibility'}
                          size={20}
                          color="#666666"
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                />
                {errors.password ? (
                  <Text style={{ color: '#000000', fontSize: 12, marginTop: 4 }}>
                    {errors.password.message}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={handleSubmit(onSubmit)}
                disabled={submitting}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Login"
                testID="login-submit"
                style={{
                  backgroundColor: '#000000',
                  opacity: submitting ? 0.6 : 1,
                  borderRadius: 10,
                  paddingVertical: 16,
                  minHeight: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 16,
                  elevation: 3,
                  shadowColor: '#000000',
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <Text
                  style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, letterSpacing: 0.8 }}
                >
                  LOGIN
                </Text>
              </TouchableOpacity>

              {submitError ? (
                <View
                  style={{
                    marginTop: 16,
                    padding: 12,
                    backgroundColor: '#F5F5F5',
                    borderRadius: 8,
                    borderLeftWidth: 3,
                    borderLeftColor: '#000000',
                  }}
                >
                  <Text style={{ color: '#000000', fontSize: 13 }}>{submitError}</Text>
                </View>
              ) : null}
            </View>
          </KeyboardAwareScrollView>
        </View>
      </TouchableWithoutFeedback>

      <Modal
        visible={configVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfigVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setConfigVisible(false)}>
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              paddingHorizontal: 24,
            }}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#E8E8E8',
                  }}
                >
                  <MaterialIcons name="settings" size={20} color="#000000" />
                  <Text
                    style={{ fontSize: 16, fontWeight: '700', marginLeft: 8, color: '#111111' }}
                  >
                    Configuration
                  </Text>
                </View>

                <View style={{ padding: 14 }}>
                  <Text style={{ fontSize: 13, color: '#555555', marginBottom: 4 }}>
                    Instance URL
                  </Text>
                  <TextInput
                    value={configDraft}
                    onChangeText={setConfigDraft}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={{
                      borderWidth: 1,
                      borderColor: '#D0D0D0',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: 15,
                      color: '#111111',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                  <Text style={{ color: '#999999', fontSize: 11, marginTop: 6 }}>
                    Enter a short name (e.g. kaitet) or a full URL. Saved on this device.
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    padding: 10,
                    borderTopWidth: 1,
                    borderTopColor: '#E8E8E8',
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setConfigVisible(false)}
                    activeOpacity={0.6}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#666666', fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveConfig}
                    activeOpacity={0.8}
                    style={{
                      flex: 2,
                      backgroundColor: '#000000',
                      borderRadius: 8,
                      paddingVertical: 14,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    <Text
                      style={{ color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.5 }}
                    >
                      SAVE
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {submitting ? <Loader /> : null}
    </SafeAreaView>
  );
}
