import { useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { ChoiceChip } from '@/components/ui/ChoiceChip';
import { useFarmGates } from '@/lib/hooks/useFarmGates';
import { COLORS, spacing, fontFamily, fontSize } from '@/src/core/theme';

type Props = {
  farm: string | null | undefined;
  value: string | null;
  onChange: (gate: string) => void;
  label?: string;
};

/**
 * "Which gate?" picker for gate-movement tracing (entry/exit gate on
 * Appointment and Timesheet). Deliberately invisible for the common case:
 * a farm with 0 or 1 configured gate has nothing to disambiguate, so it
 * auto-selects silently and renders nothing - only a farm with 2+ active
 * gates (e.g. Kapkolia) actually shows a picker. See
 * upande_security.api.gate_movement.get_farm_gates for the server side.
 */
export function GatePicker({ farm, value, onChange, label = 'Gate' }: Props) {
  const { data: gates } = useFarmGates(farm);

  // Auto-select the only gate (or the main gate, since get_farm_gates
  // already sorts main-gate-first) as soon as it's known, so single-gate
  // farms never need the guard to make a choice.
  useEffect(() => {
    if (!value && gates && gates.length >= 1) {
      onChange(gates[0].gate_name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gates]);

  if (!gates || gates.length < 2) return null;

  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text
        style={{
          fontFamily: fontFamily.semiBold,
          fontSize: fontSize.xs,
          color: COLORS.textSecondary,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {gates.map((g) => (
          <ChoiceChip
            key={g.gate_name}
            label={g.is_main_gate ? g.gate_name + ' (Main)' : g.gate_name}
            selected={value === g.gate_name}
            onPress={() => onChange(g.gate_name)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
