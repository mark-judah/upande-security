import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/stores/authStore';
import { FormInput } from '@/components/forms/FormInput';
import { Loader } from '@/components/ui/Loader';

const schema = z.object({
  url: z.string().trim().min(1, 'Instance URL required'),
  email: z.string().trim().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { url: '', email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await login(values.url, values.email, values.password);
      router.replace('/(app)/gate');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 24, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', marginTop: 24 }}>
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: '#000000',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <MaterialIcons name="shield" size={40} color="#FFFFFF" />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#000000' }}>
                Security Gate Management
              </Text>
              <Text style={{ color: '#666666', marginTop: 4 }}>Sign in to continue</Text>
            </View>

            <Controller
              control={control}
              name="url"
              render={({ field: { onChange, value, onBlur } }) => (
                <FormInput
                  label="Instance URL"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="kaitet or https://kaitet.upande.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!submitting}
                  error={errors.url?.message}
                />
              )}
            />

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

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value, onBlur } }) => (
                <FormInput
                  label="Password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="••••••••"
                  secureTextEntry
                  editable={!submitting}
                  error={errors.password?.message}
                />
              )}
            />

            {submitError ? (
              <View
                style={{
                  marginTop: 8,
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
        </ScrollView>

        <View
          style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: '#E8E8E8',
            backgroundColor: '#FFFFFF',
          }}
        >
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
        </View>
      </KeyboardAvoidingView>

      {submitting ? <Loader /> : null}
    </SafeAreaView>
  );
}
