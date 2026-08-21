import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, fontFamily, fontSize, shadow, spacing } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/auth/store';
import * as Biometric from '@/src/core/biometric';

export default function BiometricLockScreen() {
  const unlock = useAuthStore((s) => s.unlock);
  const forgetDevice = useAuthStore((s) => s.forgetDevice);
  const user = useAuthStore((s) => s.user);
  const email = user?.email ?? null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prompted = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await Biometric.authenticate({
      promptMessage: 'Unlock Upande Security',
      fallbackLabel: 'Use password',
      cancelLabel: 'Cancel',
    });
    setBusy(false);
    if (res.success) {
      unlock();
      return;
    }
    if (res.error === 'biometric_unavailable') {
      setError('Biometric unavailable on this build. Sign in with your password.');
      return;
    }
    if (res.error && !['user_cancel', 'system_cancel'].includes(res.error)) {
      setError("Couldn't verify. Try again or use your password.");
    }
  }, [busy, unlock]);

  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    tryUnlock();
  }, [tryUnlock]);

  const onForget = async () => {
    await forgetDevice();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.content}>
        <View style={s.logoCircle}>
          <Image
            source={require('@/assets/images/upande_logo.png')}
            style={{ width: 56, height: 56, resizeMode: 'contain' }}
          />
        </View>
        <Text style={s.title}>{email ?? 'Welcome back'}</Text>
        <Text style={s.sub}>Sign in with biometrics to continue.</Text>

        <TouchableOpacity onPress={tryUnlock} disabled={busy} activeOpacity={0.8} style={s.fab}>
          {busy ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Ionicons name="finger-print" size={36} color={COLORS.text} />
          )}
        </TouchableOpacity>

        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={onForget} hitSlop={8} style={s.linkBtn}>
          <Text style={s.linkText}>Use password instead</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  logoCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: COLORS.text, textAlign: 'center' },
  sub: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textSecondary, textAlign: 'center' },
  fab: {
    marginTop: spacing.lg,
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    padding: spacing.md, borderRadius: 10, maxWidth: 320,
  },
  errorText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.danger },
  linkBtn: { marginTop: spacing.md, padding: spacing.sm },
  linkText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.primary },
});
