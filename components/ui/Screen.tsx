import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';
import { Button } from './Button';
import { SideMenu } from './SideMenu';

export function Screen({
  title,
  color = COLORS.info,
  loading,
  error,
  onRetry,
  onRefresh,
  hideMenu,
  children,
  footer,
}: {
  title?: string;
  color?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => Promise<void> | void;
  hideMenu?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const handleRefresh = onRefresh
    ? async () => {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    : undefined;
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {title ? (
        <View style={[s.header, { borderBottomColor: color }]}>
          {!hideMenu ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              hitSlop={10}
              style={s.menuBtn}
              accessibilityLabel="Open menu"
            >
              <MaterialCommunityIcons name="menu" size={24} color={COLORS.text} />
            </Pressable>
          ) : null}
          <Text style={s.title}>{title}</Text>
        </View>
      ) : null}
      {!hideMenu ? (
        <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
      ) : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={color} />
          </View>
        ) : error ? (
          <View style={s.center}>
            <Text style={s.errorTitle}>Something went wrong</Text>
            <Text style={s.errorMsg}>{error}</Text>
            {onRetry ? (
              <Button
                label="Retry"
                onPress={onRetry}
                color={color}
                style={{ marginTop: 16, alignSelf: 'stretch' }}
              />
            ) : null}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              handleRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={color}
                  colors={[color]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      {footer ? (
        <View style={[s.footer, { paddingBottom: 16 + Math.max(insets.bottom, 8) }]}>
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 2,
    gap: 8,
  },
  menuBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text, flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { fontSize: 16, fontWeight: '600', color: COLORS.danger },
  errorMsg: { fontSize: 13, color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },
  footer: {
    padding: 16,
    backgroundColor: COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
});
