import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  fingerprintSaveStatus,
  getLastSite,
  isSaved,
  listSavedAccounts,
  removeAccount,
  saveAccount,
  setLastSite,
  unlockPassword,
  type SavedAccount,
} from '@/lib/services/savedAccounts';

export default function Login() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Guards against the async storage pre-fill below (useEffect on mount)
  // landing AFTER the user has already started typing and silently
  // overwriting their edit back to the previously stored email —
  // exactly the "wrong URL still logs in" bug: the field looked like it had
  // the typed value, but the delayed setUrl() clobbered it right before
  // submit read the state.
  const emailTouched = useRef(false);
  const urlTouched = useRef(false);

  // Guards saved on this phone for fingerprint sign-in (savedAccounts.ts).
  const [saved, setSaved] = useState<SavedAccount[]>([]);
  const [canSave, setCanSave] = useState(false);
  // Why fingerprint sign-in can't be offered here, if it can't.
  const [noSaveReason, setNoSaveReason] = useState<string | null>(null);
  // "Use my fingerprint to sign in next time" on the form.
  const [remember, setRemember] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Set when a saved account needs its password again (it changed, or the
  // phone's fingerprints did): the next password sign-in saves it again.
  const resaveRef = useRef(false);

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
      const [emailBackup, cookie, bioFlag] = await Promise.all([
        storage.get(StorageKeys.emailBackup),
        storage.get(StorageKeys.cookie),
        storage.get(StorageKeys.biometricEnabled),
      ]);
      if (emailBackup && !emailTouched.current) setEmail(emailBackup);
      // The site is remembered: a guard should never have to type it twice.
      const lastSite = await getLastSite();
      if (lastSite && !urlTouched.current) setUrl(lastSite.replace(/^https?:\/\//i, ''));
      setBioAvailable(!!cookie && bioFlag === '1' && Biometric.isModuleAvailable());
      const [list, status] = await Promise.all([listSavedAccounts(), fingerprintSaveStatus()]);
      setSaved(list);
      setCanSave(status.ok);
      setNoSaveReason(status.reason);
      if (list.length) setShowForm(false);
    })();
  }, []);

  // Tap a saved guard: fingerprint, then a real sign-in with the saved password.
  const signInSaved = async (a: SavedAccount) => {
    setBusyId(a.id);
    setErr(null);
    try {
      let pw: string | null;
      try {
        pw = await unlockPassword(a);
      } catch (e) {
        if (e instanceof Error && e.message === 'invalidated') {
          openFormFor(
            a,
            'The fingerprints on this phone changed. Enter your password once to save it again.',
          );
          return;
        }
        throw e;
      }
      if (pw == null) return; // fingerprint cancelled
      try {
        const { site } = await login(a.site, a.email, pw);
        await setLastSite(site);
        router.replace('/');
      } catch (e) {
        // Most likely the password was changed on the server.
        openFormFor(
          a,
          (e instanceof Error ? e.message : 'Sign-in failed') + ' - enter your current password.',
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not use the saved account');
    } finally {
      setBusyId(null);
    }
  };

  const openFormFor = (a: SavedAccount, message: string) => {
    urlTouched.current = true;
    emailTouched.current = true;
    setUrl(a.site.replace(/^https?:\/\//i, ''));
    setEmail(a.email);
    setPassword('');
    resaveRef.current = true;
    setShowForm(true);
    setErr(message);
  };

  const confirmRemove = (a: SavedAccount) => {
    Alert.alert(
      'Remove from this phone?',
      a.fullName + ' will need their password to sign in here again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeAccount(a.id);
            const list = await listSavedAccounts();
            setSaved(list);
            if (!list.length) setShowForm(true);
          },
        },
      ],
    );
  };

  // After a password sign-in with "Use my fingerprint" ticked: save the
  // account - the fingerprint prompt confirms it. A cancelled or failed save
  // only means it is offered again next sign-in.
  const saveForFingerprint = async (site: string, fullName: string, pw: string) => {
    try {
      await saveAccount({ email: email.trim(), fullName, site, password: pw });
    } catch {
      // keep going - signed in either way
    }
  };

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
        router.replace('/');
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
      const { site, fullName } = await login(url.trim(), email.trim(), password);
      await setLastSite(site);
      if (canSave && (resaveRef.current || (remember && !(await isSaved(email.trim(), site))))) {
        await saveForFingerprint(site, fullName, password);
      }
      router.replace('/');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen title="Upande Security" hideMenu>
      {saved.length ? (
        <Card>
          <Text style={s.label}>Saved on this phone</Text>
          {saved.map((a) => (
            <View key={a.id} style={s.acctRow}>
              <TouchableOpacity
                style={s.acctMain}
                onPress={() => signInSaved(a)}
                disabled={busyId != null}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={'Sign in as ' + a.fullName}
              >
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {(a.fullName || a.email).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.acctName}>{a.fullName}</Text>
                  <Text style={s.acctSub} numberOfLines={1}>
                    {a.email} · {a.site.replace(/^https?:\/\//i, '')}
                  </Text>
                </View>
                {busyId === a.id ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <Ionicons name="finger-print" size={24} color={COLORS.text} />
                )}
              </TouchableOpacity>
              <Pressable onPress={() => confirmRemove(a)} hitSlop={10} style={{ padding: 6 }}>
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </Pressable>
            </View>
          ))}
          {!showForm ? (
            <Pressable onPress={() => setShowForm(true)} style={{ paddingTop: spacing.sm }}>
              <Text style={s.link}>Use another account</Text>
            </Pressable>
          ) : null}
          {!showForm && err ? <Text style={s.err}>{err}</Text> : null}
        </Card>
      ) : null}

      {showForm ? (
        <>
          <Card>
            <Text style={s.intro}>Sign in with your Frappe user account.</Text>
          </Card>

          <Card>
            <Field
              label="Instance URL"
              value={url}
              onChange={(v) => {
                urlTouched.current = true;
                setUrl(v);
              }}
              placeholder="Enter site URL here"
              keyboardType="url"
            />
            <Field
              label="Email"
              value={email}
              onChange={(v) => {
                emailTouched.current = true;
                setEmail(v);
              }}
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
            {canSave ? (
              <Pressable
                onPress={() => setRemember((v) => !v)}
                style={s.rememberRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: remember }}
              >
                <Ionicons
                  name={remember ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={COLORS.text}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.rememberText}>Use my fingerprint to sign in next time</Text>
                  <Text style={s.rememberNote}>
                    Saves you on this phone. Anyone whose fingerprint is set up on this phone can
                    then open it.
                  </Text>
                </View>
              </Pressable>
            ) : noSaveReason ? (
              <Text style={s.rememberNote}>
                Fingerprint sign-in is not available: {noSaveReason}.
              </Text>
            ) : null}
            {err ? <Text style={s.err}>{err}</Text> : null}
          </Card>

          <Button label="Sign in" onPress={submit} loading={submitting} />
        </>
      ) : null}

      {bioAvailable && !saved.length ? (
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
  acctRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  acctMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  acctName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  acctSub: { fontSize: 12, color: COLORS.textMuted },
  link: { color: COLORS.text, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: 4,
    marginBottom: 6,
  },
  rememberText: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  rememberNote: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
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
