import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/stores/authStore';
import { useMyIncidents } from '@/lib/hooks/useMyIncidents';
import { fmtDateTime } from '@/lib/utils/date';
import type { IncidentSeverity } from '@/lib/api/types';
import { Screen } from '@/src/core/ui/Screen';
import { Button } from '@/src/core/ui/Button';
import { COLORS, borderRadius, fontSize, spacing } from '@/src/core/theme';

function severityStyle(level: IncidentSeverity): { bg: string; fg: string } {
  switch (level) {
    case 'Critical':
      return { bg: COLORS.text, fg: COLORS.bg };
    case 'High':
      return { bg: '#333333', fg: COLORS.bg };
    case 'Medium':
      return { bg: COLORS.bgMuted, fg: COLORS.text };
    case 'Low':
    default:
      return { bg: '#F5F5F5', fg: COLORS.textSecondary };
  }
}

export default function IncidentsList() {
  const userEmail = useAuthStore((s) => s.user?.email);
  const { data, isFetching, refetch } = useMyIncidents(userEmail);

  return (
    <Screen
      title="Incidents"
      onRefresh={async () => { await refetch(); }}
      footer={
        <Button
          label="REPORT INCIDENT"
          iconLeft="warning"
          onPress={() => router.push('/incident-new')}
        />
      }
    >
      {data && data.length > 0 ? (
        data.map((inc) => {
          const sev = severityStyle(inc.severity);
          return (
            <View
              key={inc.name}
              style={{
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: borderRadius.md,
                padding: 14,
                marginBottom: spacing.sm + 2,
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: COLORS.text, fontSize: fontSize.sm }}>
                    {inc.nature_of_incident}
                  </Text>
                  <Text
                    style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {inc.location}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: sev.bg,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 3,
                    borderRadius: borderRadius.full,
                    marginLeft: spacing.sm,
                  }}
                >
                  <Text
                    style={{
                      color: sev.fg,
                      fontSize: 10,
                      fontWeight: '700',
                      letterSpacing: 0.5,
                    }}
                  >
                    {inc.severity.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={{ color: COLORS.textSecondary, fontSize: fontSize.xs }} numberOfLines={2}>
                {inc.description}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: spacing.sm,
                }}
              >
                <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>{inc.name}</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
                  {fmtDateTime(inc.incident_datetime)}
                </Text>
              </View>
            </View>
          );
        })
      ) : (
        <View style={{ alignItems: 'center', padding: spacing.xxl + spacing.lg }}>
          <Ionicons name="file-tray-outline" size={48} color={COLORS.border} />
          <Text style={{ color: COLORS.textMuted, marginTop: spacing.sm + 2, fontSize: fontSize.sm }}>
            No incidents filed yet
          </Text>
          <Text
            style={{
              color: COLORS.textMuted,
              marginTop: spacing.xs,
              fontSize: fontSize.xs,
              textAlign: 'center',
            }}
          >
            Tap the button below to file one.
          </Text>
        </View>
      )}
    </Screen>
  );
}
