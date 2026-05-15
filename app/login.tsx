import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { COLORS } from '@/constants/colors';
import { useAuthStore } from '@/lib/stores/authStore';
import { getWorkingUrl } from '@/lib/utils/url';

export default function Login() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [instanceUrl, setInstanceUrl] = useState('');
  const [urlLoaded, setUrlLoaded] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [urlErr, setUrlErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const stored = (await AsyncStorage.getItem('instanceurl')) ?? '';
      setInstanceUrl(stored);
      setDraftUrl(stored);
      const storedEmail = await AsyncStorage.getItem('user_email');
      if (storedEmail) setEmail(storedEmail);
      setUrlLoaded(true);
    })();
  }, []);

  const saveUrl = async () => {
    const u = draftUrl.trim();
    if (!u) {
      setUrlErr('Enter a URL');
      return;
    }
    setResolvingUrl(true);
    setUrlErr(null);
    try {
      const resolved = (await getWorkingUrl(u)) ?? u;
      if (resolved !== instanceUrl) {
        await AsyncStorage.multiRemove(['cookie', 'user_email']);
      }
      await AsyncStorage.setItem('instanceurl', resolved);
      setInstanceUrl(resolved);
      setDraftUrl(resolved);
      setConfigOpen(false);
    } finally {
      setResolvingUrl(false);
    }
  };

  const submit = async () => {
    if (!instanceUrl) {
      setErr("Instance URL not configured. Tap 'Configure instance URL' below.");
      setConfigOpen(true);
      return;
    }
    if (!email.trim() || !password) {
      setErr('Email and password are required.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await login(instanceUrl, email.trim(), password);
      router.replace('/');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!urlLoaded) return <Screen loading hideMenu>{null}</Screen>;

  return (
    <Screen hideMenu>
      <View style={s.logoWrap}>
        <Image
          source={require('../assets/images/upande_logo.png')}
          style={s.logo}
          resizeMode="contain"
        />
      </View>

      <Card>
        <Text style={s.intro}>Sign in with your Frappe user account.</Text>
        <Text style={s.meta}>
          Instance: <Text style={{ fontWeight: '600' }}>{instanceUrl || 'not set'}</Text>
        </Text>
      </Card>

      <Card>
        <Text style={s.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!submitting}
          style={s.input}
          placeholder="you@example.com"
          placeholderTextColor={COLORS.textMuted}
        />

        <Text style={[s.label, { marginTop: 10 }]}>Password</Text>
        <View style={s.pwRow}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            editable={!submitting}
            style={s.pwInput}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textMuted}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            <Text style={s.pwToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>
        {err ? <Text style={s.err}>{err}</Text> : null}
      </Card>

      <Button label="Sign in" onPress={submit} loading={submitting} color={COLORS.info} />

      <Pressable
        onPress={() => {
          setDraftUrl(instanceUrl);
          setConfigOpen(true);
        }}
        style={{ paddingVertical: 12 }}
      >
        <Text style={s.configLink}>Configure instance URL</Text>
      </Pressable>

      <Modal
        visible={configOpen}
        transparent
        animationType="fade"
        onRequestClose={() => (resolvingUrl ? null : setConfigOpen(false))}
      >
        <View style={s.modalWrap}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Instance URL</Text>
            <TextInput
              value={draftUrl}
              onChangeText={(v) => {
                setDraftUrl(v);
                if (urlErr) setUrlErr(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://your-site.upande.com"
              placeholderTextColor={COLORS.textMuted}
              style={s.modalInput}
              editable={!resolvingUrl}
            />
            <Text style={s.modalHint}>
              Enter a short name (e.g. kaitet) or a full URL. Saved on this device.
            </Text>
            {urlErr ? <Text style={s.urlErr}>{urlErr}</Text> : null}
            <View style={s.modalBtns}>
              <Button
                label="Cancel"
                variant="outline"
                color={COLORS.textMuted}
                disabled={resolvingUrl}
                onPress={() => {
                  setConfigOpen(false);
                  setUrlErr(null);
                }}
                style={{ flex: 1 }}
              />
              <Button
                label="Save"
                onPress={saveUrl}
                loading={resolvingUrl}
                color={COLORS.info}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  logoWrap: { alignItems: 'center', paddingVertical: 24 },
  logo: { width: 220, height: 80 },
  intro: { fontSize: 14, color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
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
  pwToggle: { color: COLORS.info, fontSize: 13, fontWeight: '600', padding: 6 },
  err: { color: COLORS.danger, fontSize: 13, marginTop: 8 },
  configLink: {
    textAlign: 'center',
    color: COLORS.info,
    fontSize: 13,
    fontWeight: '500',
  },
  modalWrap: {
    flex: 1,
    backgroundColor: '#00000066',
    padding: 24,
    justifyContent: 'center',
  },
  modalCard: { backgroundColor: COLORS.bg, borderRadius: 14, padding: 16 },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  modalHint: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
  urlErr: { fontSize: 12, color: COLORS.danger, marginTop: 6, lineHeight: 16 },
  modalBtns: { flexDirection: 'row', gap: 8, marginTop: 14 },
});
