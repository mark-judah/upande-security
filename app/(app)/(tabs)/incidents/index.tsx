import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/stores/authStore';
import { useMyIncidents } from '@/lib/hooks/useMyIncidents';
import { fmtDateTime } from '@/lib/utils/date';
import type { IncidentSeverity } from '@/lib/api/types';

function severityStyle(level: IncidentSeverity): { bg: string; fg: string } {
  switch (level) {
    case 'Critical':
      return { bg: '#000000', fg: '#FFFFFF' };
    case 'High':
      return { bg: '#333333', fg: '#FFFFFF' };
    case 'Medium':
      return { bg: '#E0E0E0', fg: '#111111' };
    case 'Low':
    default:
      return { bg: '#F5F5F5', fg: '#333333' };
  }
}

export default function IncidentsList() {
  const userEmail = useAuthStore((s) => s.user?.email);
  const { data, isFetching, refetch } = useMyIncidents(userEmail);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#E8E8E8' }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#000000' }}>Incidents</Text>
        <Text style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>
          Reports filed by you
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />}
      >
        {data && data.length > 0 ? (
          data.map((inc) => {
            const sev = severityStyle(inc.severity);
            return (
              <View
                key={inc.name}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E8E8E8',
                  borderLeftWidth: 4,
                  borderLeftColor: '#000000',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: '#111111', fontSize: 14 }}>
                      {inc.nature_of_incident}
                    </Text>
                    <Text
                      style={{ color: '#666666', fontSize: 12, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {inc.location}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: sev.bg,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      marginLeft: 8,
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
                <Text style={{ color: '#333333', fontSize: 12 }} numberOfLines={2}>
                  {inc.description}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: '#999999', fontSize: 11 }}>{inc.name}</Text>
                  <Text style={{ color: '#999999', fontSize: 11 }}>
                    {fmtDateTime(inc.incident_datetime)}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <MaterialIcons name="inbox" size={48} color="#BDBDBD" />
            <Text style={{ color: '#888888', marginTop: 10, fontSize: 13 }}>
              No incidents filed yet
            </Text>
            <Text style={{ color: '#AAAAAA', marginTop: 4, fontSize: 12, textAlign: 'center' }}>
              Tap the button below to file one.
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        onPress={() => router.push('/(app)/(tabs)/incidents/new')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Report incident"
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          backgroundColor: '#000000',
          borderRadius: 12,
          paddingVertical: 16,
          minHeight: 56,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          elevation: 4,
          shadowColor: '#000000',
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <MaterialIcons name="add-alert" size={22} color="#FFFFFF" />
        <Text
          style={{
            color: '#FFFFFF',
            fontWeight: '700',
            marginLeft: 8,
            fontSize: 15,
            letterSpacing: 0.5,
          }}
        >
          REPORT INCIDENT
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
