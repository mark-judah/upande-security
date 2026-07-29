import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/auth/store';
import { storage, StorageKeys } from '@/src/core/storage';
import { useDrawerItems } from './drawer-items-context';
import { APP_VERSION } from '@/src/core/version';

export function SideMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const logout = useAuthStore((s) => s.logout);
  const storeUser = useAuthStore((s) => s.user);
  const instanceUrl = useAuthStore((s) => s.instanceUrl);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const drawerWidth = Math.min(Math.max(screenWidth * 0.8, 240), 320);
  const slide = useRef(new Animated.Value(-drawerWidth)).current;

  const [email, setEmail] = useState(storeUser?.email ?? '');

  useEffect(() => {
    if (!visible) return;
    // Fallback to AsyncStorage when the auth store hasn't been populated yet
    // (e.g. legacy paths that mount SideMenu before hydrate finishes).
    if (!storeUser?.email) {
      storage.get(StorageKeys.emailBackup).then((e) => { if (e) setEmail(e); });
    } else {
      setEmail(storeUser.email);
    }
  }, [visible, storeUser?.email]);

  useEffect(() => {
    if (visible) {
      slide.setValue(-drawerWidth);
      Animated.timing(slide, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    } else {
      slide.setValue(-drawerWidth);
    }
  }, [visible, drawerWidth, slide]);

  const closeWithAnim = () => {
    Animated.timing(slide, { toValue: -drawerWidth, duration: 200, useNativeDriver: true })
      .start(() => onClose());
  };

  const items = useDrawerItems();

  const go = (route: string) => {
    closeWithAnim();
    setTimeout(() => router.replace(`/${route}` as never), 220);
  };

  const onSettings = () => {
    closeWithAnim();
    setTimeout(() => router.push('/settings' as never), 220);
  };

  const onLogout = async () => {
    closeWithAnim();
    setTimeout(async () => {
      await logout();
      router.replace('/login');
    }, 220);
  };

  // Initials derive from the email: first letter of local part + first letter
  // after the first dot or separator (e.g. "judah@upande.com" → "J", or
  // "first.last@x" → "FL"). Falls back to a single uppercase letter.
  const initials = (() => {
    if (!email) return '?';
    const local = email.split('@')[0] ?? '';
    const parts = local.split(/[.\-_]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0]?.[0] ?? email[0] ?? '?').toUpperCase();
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeWithAnim}
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
    >
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={closeWithAnim} />
        <Animated.View
          style={[
            s.drawer,
            { width: drawerWidth, transform: [{ translateX: slide }] },
          ]}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'bottom']}>
            <ScrollView
              contentContainerStyle={[s.scroll, { paddingTop: insets.top > 0 ? spacing.md : spacing.lg }]}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View style={s.header}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials}</Text>
                </View>
                <Text style={s.name} numberOfLines={1}>
                  {email || 'User'}
                </Text>
                {instanceUrl ? (
                  <Text style={s.meta} numberOfLines={1}>
                    {instanceUrl.replace(/^https?:\/\//, '')}
                  </Text>
                ) : null}
              </View>

              <View style={s.nav}>
                {items.length === 0 ? (
                  <Text style={s.empty}>No screens configured.</Text>
                ) : (
                  items.map((item) => (
                    <Pressable
                      key={item.route}
                      style={({ pressed }) => [s.navItem, pressed && s.navItemPressed]}
                      onPress={() => go(item.route)}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                      <Text style={s.navLabel}>{item.label}</Text>
                    </Pressable>
                  ))
                )}
              </View>

              <View style={s.footer}>
                <Pressable style={s.footerRow} onPress={onSettings} hitSlop={4}>
                  <View style={[s.badge, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="cog-outline" size={15} color="#6366F1" />
                  </View>
                  <Text style={s.footerText}>Settings</Text>
                </Pressable>
                <Pressable style={s.footerRow} onPress={onLogout} hitSlop={4}>
                  <View style={[s.badge, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="log-out-outline" size={15} color={COLORS.danger} />
                  </View>
                  <Text style={[s.footerText, { color: COLORS.danger }]}>Sign Out</Text>
                </Pressable>
                <Text style={s.version}>Upande Security v{APP_VERSION}</Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.surface,
    elevation: 24,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg },
  header: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: COLORS.textOnPrimary },
  name: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text },
  meta: { fontFamily: fontFamily.regular, fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

  nav: { paddingTop: spacing.xs, paddingBottom: spacing.sm },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  navItemPressed: { backgroundColor: COLORS.surfaceAlt },
  navLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text },
  empty: { paddingHorizontal: spacing.sm, fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: COLORS.textMuted },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  footerText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text, flex: 1 },
  version: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
