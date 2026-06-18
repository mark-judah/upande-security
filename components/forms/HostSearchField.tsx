import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEmployeeSearch } from '@/lib/hooks/useEmployeeSearch';
import { COLORS, borderRadius, fontSize, spacing } from '@/src/core/theme';

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
  const noResults =
    !selectedHostId && debounced.length >= 2 && !isFetching && (results?.length ?? 0) === 0;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text
        style={{
          fontSize: fontSize.xs,
          color: COLORS.textMuted,
          marginBottom: spacing.xs,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        Person to Visit *
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? COLORS.danger : COLORS.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          backgroundColor: COLORS.bg,
        }}
      >
        <Ionicons
          name={selectedHostId ? 'person' : 'person-circle-outline'}
          size={20}
          color={COLORS.textMuted}
          style={{ marginRight: spacing.sm }}
        />
        <TextInput
          value={selectedHostName ?? query}
          onChangeText={(v) => {
            if (selectedHostId) onClear();
            setQuery(v);
          }}
          placeholder="Search by name"
          placeholderTextColor={COLORS.textMuted}
          editable={!selectedHostId}
          autoCapitalize="words"
          autoCorrect={false}
          style={{
            flex: 1,
            paddingVertical: spacing.sm + 2,
            fontSize: fontSize.md,
            color: COLORS.text,
            fontWeight: selectedHostId ? '600' : '400',
          }}
        />
        {selectedHostId ? (
          <Pressable
            onPress={onClear}
            hitSlop={10}
            accessibilityLabel="Clear selected host"
          >
            <Ionicons name="close" size={20} color={COLORS.text} />
          </Pressable>
        ) : isFetching ? (
          <ActivityIndicator size="small" color={COLORS.text} />
        ) : (
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
        )}
      </View>

      {showDropdown ? (
        <View
          style={{
            marginTop: 6,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: borderRadius.md,
            backgroundColor: COLORS.bg,
            maxHeight: 260,
            overflow: 'hidden',
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {(results ?? []).map((r, idx) => {
              const fullName =
                `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() ||
                r.employee_name ||
                r.name;
              const meta = [r.designation, r.department].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={r.name}
                  onPress={() => {
                    onSelect(r.name, fullName);
                    setQuery('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${fullName}`}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.md,
                    paddingHorizontal: 14,
                    backgroundColor: pressed ? COLORS.bgMuted : COLORS.bg,
                    borderBottomWidth: idx === (results?.length ?? 0) - 1 ? 0 : 1,
                    borderBottomColor: COLORS.bgMuted,
                  })}
                >
                  <Text
                    style={{
                      color: COLORS.text,
                      fontSize: fontSize.md,
                      fontWeight: '600',
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {fullName}
                  </Text>
                  {meta ? (
                    <Text
                      style={{
                        color: COLORS.textMuted,
                        fontSize: fontSize.xs,
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {meta}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {noResults ? (
        <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, marginTop: 6 }}>
          No active employees match "{debounced}".
        </Text>
      ) : null}

      {error ? (
        <Text style={{ color: COLORS.danger, fontSize: fontSize.xs, marginTop: spacing.xs }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
