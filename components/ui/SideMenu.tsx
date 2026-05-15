import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';
import { APP_VERSION } from '@/constants/app';
import { useAuthStore } from '@/lib/stores/authStore';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Item = { label: string; route: string; icon: IconName };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Gate',
    items: [
      { label: 'Check in', route: '/(app)/(tabs)/gate', icon: 'login' },
      { label: 'Daily summary', route: '/(app)/(tabs)/gate/summary', icon: 'view-dashboard' },
    ],
  },
  {
    title: 'Field',
    items: [
      { label: 'Patrol', route: '/(app)/(tabs)/patrol', icon: 'walk' },
      { label: 'Incidents', route: '/(app)/(tabs)/incidents', icon: 'alert-octagon' },
    ],
  },
];

export function SideMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const instanceUrl = useAuthStore((s) => s.instanceUrl);
  const logout = useAuthStore((s) => s.logout);

  const go = (route: string) => {
    onClose();
    router.replace(route as never);
  };

  const onLogout = async () => {
    onClose();
    await logout();
    router.replace('/login');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.panel} onPress={() => {}}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'bottom']}>
            <View style={s.header}>
              <Image
                source={require('../../assets/images/upande_logo.png')}
                style={s.brandLogo}
                resizeMode="contain"
              />
              <Pressable onPress={onClose} hitSlop={10} style={s.close}>
                <MaterialCommunityIcons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>

            <View style={s.user}>
              <Text style={s.userEmail}>{user?.email ?? '—'}</Text>
              {instanceUrl ? <Text style={s.userMeta}>{instanceUrl}</Text> : null}
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              {SECTIONS.map((section) => (
                <View key={section.title} style={s.section}>
                  <Text style={s.sectionTitle}>{section.title}</Text>
                  {section.items.map((item) => (
                    <Pressable
                      key={item.route}
                      style={s.row}
                      onPress={() => go(item.route)}
                    >
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={20}
                        color={COLORS.text}
                      />
                      <Text style={s.rowLabel}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}

              <View style={s.footer}>
                <Pressable style={s.row} onPress={onLogout}>
                  <MaterialCommunityIcons
                    name="logout"
                    size={20}
                    color={COLORS.danger}
                  />
                  <Text style={[s.rowLabel, { color: COLORS.danger }]}>Sign out</Text>
                </Pressable>
              </View>

              <Text style={s.version}>Version {APP_VERSION}</Text>
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', flexDirection: 'row' },
  panel: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: COLORS.bg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.text,
  },
  brandLogo: { width: 140, height: 36 },
  close: { padding: 4 },
  user: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  userEmail: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  userMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  section: { paddingTop: 12, paddingBottom: 4 },
  sectionTitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowLabel: { fontSize: 14, color: COLORS.text },
  footer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  version: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
