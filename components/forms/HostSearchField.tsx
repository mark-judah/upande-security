import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useEmployeeSearch } from '@/lib/hooks/useEmployeeSearch';
import { theme } from '@/constants/theme';

type Props = {
  selectedHostId: string | null;
  selectedHostName: string | null;
  onSelect: (id: string, name: string) => void;
  onClear: () => void;
  error?: string;
};

export function HostSearchField({
  selectedHostId,
  selectedHostName,
  onSelect,
  onClear,
  error,
}: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  const { data: results, isFetching } = useEmployeeSearch(debounced);
  const showDropdown = !selectedHostId && debounced.length >= 2 && (results?.length ?? 0) > 0;

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>Person to Visit *</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? theme.error : '#D0D0D0',
          borderRadius: 8,
          paddingHorizontal: 12,
          backgroundColor: 'white',
        }}
      >
        <TextInput
          value={selectedHostName ?? query}
          onChangeText={(v) => {
            if (selectedHostId) onClear();
            setQuery(v);
          }}
          placeholder="Search employee by name"
          placeholderTextColor="#A0A0A0"
          editable={!selectedHostId}
          autoCapitalize="words"
          autoCorrect={false}
          style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: '#111' }}
        />
        {selectedHostId ? (
          <Pressable onPress={onClear} hitSlop={8}>
            <MaterialIcons name="close" size={18} color="#666" />
          </Pressable>
        ) : isFetching ? (
          <ActivityIndicator size="small" color={theme.primaryColor} />
        ) : (
          <MaterialIcons name="search" size={20} color="#666" />
        )}
      </View>

      {selectedHostId && selectedHostName ? (
        <View
          style={{
            marginTop: 6,
            alignSelf: 'flex-start',
            backgroundColor: '#E8F5E9',
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <MaterialIcons name="check-circle" size={14} color={theme.success} />
          <Text style={{ color: '#2E7D32', fontSize: 12, marginLeft: 4 }}>
            {selectedHostName} · {selectedHostId}
          </Text>
        </View>
      ) : null}

      {showDropdown ? (
        <View
          style={{
            marginTop: 4,
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 8,
            backgroundColor: 'white',
            maxHeight: 220,
            overflow: 'hidden',
            elevation: 4,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          {(results ?? []).map((r) => (
            <Pressable
              key={r.name}
              onPress={() => {
                onSelect(r.name, r.employee_name);
                setQuery('');
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                padding: 10,
                backgroundColor: pressed ? '#F5F5F5' : 'white',
                borderBottomWidth: 1,
                borderBottomColor: '#F0F0F0',
              })}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: theme.primaryColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>
                  {r.employee_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontWeight: '600', color: '#111' }}>{r.employee_name}</Text>
                <Text style={{ color: '#666', fontSize: 12 }}>
                  {[r.designation, r.department].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={{ color: '#999', fontSize: 11 }}>{r.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? (
        <Text style={{ color: theme.error, fontSize: 12, marginTop: 4 }}>{error}</Text>
      ) : null}
    </View>
  );
}
