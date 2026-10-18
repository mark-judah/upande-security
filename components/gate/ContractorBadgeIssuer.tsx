import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

/**
 * After a contractor visit is checked in: give each crew member a numbered
 * Contractor Badge from the pool. With it they move between the company's
 * farms by scanning at the gate, without being booked again. The badges go
 * back to the pool when the visit is checked out.
 */
export function ContractorBadgeIssuer({ appointment }: { appointment: string }) {
  const feedback = useFeedback();
  const qc = useQueryClient();
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [issuing, setIssuing] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['contractor-badges', appointment],
    queryFn: () => api.contractorBadgesForVisit(appointment),
    retry: false,
  });

  if (query.isLoading) return <ActivityIndicator color={COLORS.primary} style={{ marginTop: spacing.md }} />;
  // Older server without contractor badges - say nothing.
  if (query.isError || !query.data) return null;

  const { crew, badges, valid_until } = query.data;
  const badgeOf = (name: string) => badges.find((b) => b.holder_name.toLowerCase() === name.toLowerCase());

  async function issue(person: { full_name: string; id_number?: string }) {
    const n = (numbers[person.full_name] || '').trim();
    if (!n) {
      feedback.warning('Enter the badge number');
      return;
    }
    setIssuing(person.full_name);
    try {
      const b = await api.issueContractorBadge({
        appointment,
        badge_number: n,
        holder_name: person.full_name,
        holder_id_number: person.id_number || undefined,
      });
      feedback.success(`Badge #${b.badge_number} given to ${b.holder_name}`);
      setNumbers((x) => ({ ...x, [person.full_name]: '' }));
      qc.invalidateQueries({ queryKey: ['contractor-badges', appointment] });
    } catch (e) {
      feedback.error(e instanceof Error ? e.message : 'Could not issue the badge');
    } finally {
      setIssuing(null);
    }
  }

  return (
    <View style={{ marginTop: spacing.md, padding: 14, borderRadius: borderRadius.md, backgroundColor: COLORS.surfaceAlt }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="id-card-outline" size={20} color="#B45309" />
        <Text style={{ marginLeft: 8, fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text }}>
          Contractor badges
        </Text>
      </View>
      <Text style={{ marginTop: 4, color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
        One badge per person. They scan it at any gate of the company until {valid_until} — no booking at the next farm.
      </Text>
      <Text style={{ marginTop: 4, color: '#B45309', fontSize: fontSize.xs, fontFamily: fontFamily.semiBold }}>
        Tell each person: a lost badge is charged KES 300.
      </Text>
      {crew.map((p) => {
        const b = badgeOf(p.full_name);
        return (
          <View
            key={p.full_name}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, color: COLORS.text }}>
                {p.full_name}
                {p.is_team_leader ? ' (leader)' : ''}
              </Text>
              {p.id_number ? (
                <Text style={{ color: COLORS.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.regular }}>
                  ID {p.id_number}
                </Text>
              ) : null}
            </View>
            {b ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                <Text style={{ marginLeft: 4, color: COLORS.success, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm }}>
                  Badge #{b.badge_number}
                </Text>
              </View>
            ) : (
              <>
                <TextInput
                  value={numbers[p.full_name] || ''}
                  onChangeText={(v) => setNumbers((x) => ({ ...x, [p.full_name]: v.replace(/[^0-9]/g, '') }))}
                  placeholder="Badge #"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  editable={issuing == null}
                  style={{
                    width: 76,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 8,
                    fontSize: fontSize.sm,
                    color: COLORS.text,
                    backgroundColor: COLORS.surface,
                  }}
                />
                <TouchableOpacity
                  onPress={() => issue(p)}
                  disabled={issuing != null}
                  style={{
                    backgroundColor: '#B45309',
                    opacity: issuing != null ? 0.6 : 1,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 9,
                  }}
                >
                  {issuing === p.full_name ? (
                    <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
                  ) : (
                    <Text style={{ color: COLORS.textOnPrimary, fontFamily: fontFamily.semiBold, fontSize: fontSize.sm }}>
                      Issue
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}
