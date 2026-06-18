import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/core/ui/Screen';
import { Card } from '@/src/core/ui/Card';
import { Button } from '@/src/core/ui/Button';
import { useAuthStore } from '@/src/core/auth/store';
import { storage, StorageKeys } from '@/src/core/storage';
import * as Biometric from '@/src/core/biometric';
import { COLORS, borderRadius, shadow, spacing } from '@/src/core/theme';
import { APP_VERSION } from '@/src/core/version';

export default function Login() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const login = useAuthStore((s) => s.login);
  const hydrate = useAuthStore((s) => s.hydrate);
  const unlock = useAuthStore((s) => s.unlock);

  // Biometric login is available when:
  //   - a session cookie is still stored on this device, AND
  //   - the biometric_enabled flag was turned on in Settings, AND
  //   - the native biometric module is present in the running binary
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [emailBackup, instanceUrlStored, cookie, bioFlag] = await Promise.all([
        storage.get(StorageKeys.emailBackup),
        storage.get(StorageKeys.instanceUrl),
        storage.get(StorageKeys.cookie),
        storage.get(StorageKeys.biometricEnabled),
      ]);
      if (emailBackup) setEmail(emailBackup);
      if (instanceUrlStored) setUrl(instanceUrlStored.replace(/^https?:\/\//i, ''));
      setBioAvailable(!!cookie && bioFlag === '1' && Biometric.isModuleAvailable());
    })();
  }, []);

  const onBiometric = async () => {
    setBioBusy(true);
    setErr(null);
    try {
      const res = await Biometric.authenticate({
        promptMessage: 'Unlock Upande Security',
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
      });
      if (res.success) {
        // Stored session is the authentication; biometric just gates the unlock.
        await hydrate();
        unlock();
        router.replace('/gate');
      } else if (res.error && !['user_cancel', 'system_cancel'].includes(res.error)) {
        setErr("Couldn't verify biometric. Use your password.");
      }
    } finally {
      setBioBusy(false);
    }
  };

  const submit = async () => {
    if (!url.trim()) {
      setErr('Instance URL is required.');
      return;
    }
    if (!email.trim() || !password) {
      setErr('Email and password are required.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      // authStore.login calls lib/api/auth.login which internally resolves
      // shortform URLs like 'kaitet' via getWorkingUrl.
      await login(url.trim(), email.trim(), password);
      router.replace('/gate');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen title="Upande Security" hideMenu>
      <Card>
        <Text style={s.intro}>Sign in with your Frappe user account.</Text>
      </Card>

      <Card>
        <Field
          label="Instance URL"
          value={url}
          onChange={setUrl}
          placeholder="kaitet.upande.com"
          keyboardType="url"
        />
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          keyboardType="email-address"
        />
        <View style={s.pwWrap}>
          <Text style={s.label}>Password</Text>
          <View style={s.pwRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={s.pwInput}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Text style={s.pwToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
        </View>
        {err ? <Text style={s.err}>{err}</Text> : null}
      </Card>

      <Button label="Sign in" onPress={submit} loading={submitting} />

      {bioAvailable ? (
        <TouchableOpacity
          onPress={onBiometric}
          disabled={bioBusy}
          activeOpacity={0.8}
          style={s.bioFab}
        >
          {bioBusy ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Ionicons name="finger-print" size={28} color={COLORS.text} />
          )}
        </TouchableOpacity>
      ) : null}

      <View style={s.footer}>
        <Text style={s.version}>v{APP_VERSION}</Text>
      </View>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'url';
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType ?? 'default'}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        style={s.input}
      />
    </View>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 14, color: COLORS.text },
  label: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  pwWrap: { marginBottom: 10 },
  pwRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 10,
  },
  pwInput: { flex: 1, fontSize: 15, color: COLORS.text, paddingVertical: 10 },
  pwToggle: { color: COLORS.text, fontSize: 13, fontWeight: '600', padding: 6 },
  err: { color: COLORS.danger, fontSize: 13, marginTop: 4 },
  footer: { alignItems: 'center', paddingTop: 24 },
  version: { fontSize: 11, color: COLORS.textMuted },
  bioFab: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
});
