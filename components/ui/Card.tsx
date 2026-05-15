import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { COLORS } from '@/constants/colors';

export function Card({
  title,
  children,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.card, style]}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warn' | 'danger';
  children: React.ReactNode;
}) {
  const color =
    tone === 'success'
      ? COLORS.success
      : tone === 'warn'
        ? COLORS.warn
        : tone === 'danger'
          ? COLORS.danger
          : COLORS.info;
  return (
    <View style={[s.alert, { borderLeftColor: color, backgroundColor: `${color}14` }]}>
      <Text style={[s.alertText, { color: COLORS.text }]}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  alert: {
    borderLeftWidth: 4,
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  alertText: { fontSize: 13, lineHeight: 18 },
});
