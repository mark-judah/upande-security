import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, fontFamily, fontSize } from '@/src/core/theme';
import { AnimatedTabIcon } from '@/src/core/ui/AnimatedTabIcon';

type TabIconPair = {
  outline: keyof typeof Ionicons.glyphMap;
  filled: keyof typeof Ionicons.glyphMap;
};

/** Bottom-tab icons. Hidden routes (Visits / Summary / Settings) live in
 *  the drawer only and don't need entries here — they're declared with
 *  href: null below so the navigator knows the routes exist. */
const ICONS: Record<string, TabIconPair> = {
  index:     { outline: 'home-outline',              filled: 'home' },
  gate:      { outline: 'log-in-outline',            filled: 'log-in' },
  approved:  { outline: 'checkmark-circle-outline',  filled: 'checkmark-circle' },
  patrol:    { outline: 'walk-outline',              filled: 'walk' },
  incidents: { outline: 'warning-outline',           filled: 'warning' },
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        // Each screen mounts its own <Screen title=...> (from src/core/ui),
        // which renders the canonical hairline header + hamburger that opens
        // the SideMenu drawer. So the Tabs navigator stays headerless.
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 64 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarItemStyle: { paddingTop: 4 },
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
        tabBarIcon: ({ focused, size }) => {
          const pair = ICONS[route.name];
          if (!pair) return <Ionicons name="help-outline" size={size} color={COLORS.textMuted} />;
          return (
            <AnimatedTabIcon
              outline={pair.outline}
              filled={pair.filled}
              focused={focused}
              size={size}
            />
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="gate" options={{ title: 'Gate' }} />
      <Tabs.Screen name="approved" options={{ title: 'Approved' }} />
      <Tabs.Screen name="patrol" options={{ title: 'Patrol' }} />
      <Tabs.Screen name="incidents" options={{ title: 'Incidents' }} />

      {/* Drawer-only routes — registered so they're navigable, hidden from the bar */}
      <Tabs.Screen name="visits" options={{ title: 'Visits', href: null }} />
      <Tabs.Screen name="summary" options={{ title: 'Summary', href: null }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', href: null }} />
    </Tabs>
  );
}
