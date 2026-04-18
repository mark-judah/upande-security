import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTractorTaskSearch } from '@/lib/hooks/useTractorTaskSearch';
import type { TractorTaskSearchResult } from '@/lib/api/vehicles';

type Props = {
  onPickTicket: (name: string) => void;
  disabled?: boolean;
};

export function VehicleScanAction({ onPickTicket, disabled }: Props) {
  const [query, setQuery] = useState('');
  const search = useTractorTaskSearch();
  const results: TractorTaskSearchResult[] = search.data ?? [];

  function onSearch() {
    const q = query.trim();
    if (!q) return;
    search.mutate(q);
  }

  return (
    <View style={{ marginTop: 12 }}>
      <TouchableOpacity
        onPress={() => router.push('/(app)/scan')}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: '#000000',
          opacity: disabled ? 0.6 : 1,
          paddingVertical: 18,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 60,
        }}
      >
        <MaterialIcons name="qr-code-scanner" size={24} color="#FFFFFF" />
        <Text
          style={{
            color: '#FFFFFF',
            fontWeight: '700',
            marginLeft: 8,
            fontSize: 15,
            letterSpacing: 0.5,
          }}
        >
          SCAN WORK TICKET
        </Text>
      </TouchableOpacity>

      <Text style={{ textAlign: 'center', color: '#666666', marginVertical: 10, fontSize: 12 }}>
        Or search by ticket / vehicle reg
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#D0D0D0',
          borderRadius: 8,
          paddingHorizontal: 12,
          backgroundColor: '#FFFFFF',
        }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. KAY or 310780"
          placeholderTextColor="#A0A0A0"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!disabled}
          returnKeyType="search"
          onSubmitEditing={onSearch}
          style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: '#111111' }}
        />
        {search.isPending ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <TouchableOpacity
            onPress={onSearch}
            disabled={disabled}
            hitSlop={8}
            activeOpacity={0.6}
          >
            <MaterialIcons name="search" size={22} color="#000000" />
          </TouchableOpacity>
        )}
      </View>

      {search.isSuccess && results.length === 0 ? (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <MaterialIcons name="inbox" size={28} color="#999999" />
          <Text style={{ color: '#666666', marginTop: 6, fontSize: 12 }}>
            No tickets match &quot;{query}&quot;
          </Text>
        </View>
      ) : null}

      {results.length > 0 ? (
        <View
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: '#E8E8E8',
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            overflow: 'hidden',
          }}
        >
          {results.map((r, i) => (
            <TouchableOpacity
              key={r.name}
              onPress={() => onPickTicket(r.name)}
              activeOpacity={0.7}
              style={{
                padding: 12,
                borderBottomWidth: i === results.length - 1 ? 0 : 1,
                borderBottomColor: '#F0F0F0',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: '#F5F5F5',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="agriculture" size={20} color="#000000" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontWeight: '700', color: '#111111', fontSize: 13 }}
                >
                  {r.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: '#666666', fontSize: 12, marginTop: 2 }}
                >
                  {[r.motor_vehicle, r.farm].filter(Boolean).join(' · ') || '—'}
                </Text>
                {r.date || r.workflow_state ? (
                  <Text
                    numberOfLines={1}
                    style={{ color: '#999999', fontSize: 11, marginTop: 2 }}
                  >
                    {[r.date, r.workflow_state].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#999999" />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}
