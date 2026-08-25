import { Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DispatchExpectedItem } from '@/lib/services/api';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  items: DispatchExpectedItem[];
  values: Record<string, string>;
  onChange: (rowId: string, text: string) => void;
  disabled?: boolean;
};

/**
 * Per-item content-verification checklist shown above the Verify/Reject
 * decision buttons when the matched dispatch document carries a per-item
 * breakdown (`expected_items`). The guard enters what they actually
 * counted for each row, keyed by the source document's own child-row
 * `row_id` — never by `item_code`, since the same item can legitimately
 * appear on more than one row (different destinations/customers) and
 * grouping by item_code alone would misattribute quantities.
 *
 * The checkmark/short/over indicator rendered here as the guard types is
 * PROVISIONAL / ADVISORY ONLY — it's a client-side comparison against the
 * expected qty to give instant feedback while counting. The authoritative
 * `match_status` per item is computed server-side and only exists after
 * the guard submits their Verify/Reject decision — see the "verified"
 * success card in DispatchGatePanel, which renders that server response.
 */
export function DispatchItemChecklist({ items, values, onChange, disabled }: Props) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text
        style={{
          fontFamily: fontFamily.semiBold,
          fontSize: fontSize.sm,
          color: COLORS.text,
          marginBottom: spacing.xs,
        }}
      >
        Verify item quantities
      </Text>
      <View style={{ gap: spacing.sm }}>
        {items.map((item) => {
          const raw = values[item.row_id] ?? '';
          const trimmed = raw.trim();
          const entered = trimmed.length > 0 ? Number(trimmed) : null;
          const hasEntry = entered != null && !Number.isNaN(entered);

          let indicatorIcon: keyof typeof Ionicons.glyphMap | null = null;
          let indicatorColor: string = COLORS.textMuted;
          if (hasEntry) {
            if (entered === item.qty) {
              indicatorIcon = 'checkmark-circle';
              indicatorColor = COLORS.success;
            } else if ((entered as number) < item.qty) {
              indicatorIcon = 'arrow-down-circle';
              indicatorColor = COLORS.warn;
            } else {
              indicatorIcon = 'arrow-up-circle';
              indicatorColor = COLORS.danger;
            }
          }

          return (
            <View
              key={item.row_id}
              style={{
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: borderRadius.sm,
                padding: spacing.sm + 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: COLORS.text }}>
                    {item.item_name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fontFamily.regular,
                      fontSize: fontSize.xs,
                      color: COLORS.textMuted,
                      marginTop: 2,
                    }}
                  >
                    Expected: {item.qty} {item.uom ?? ''}
                  </Text>
                </View>
                {indicatorIcon ? <Ionicons name={indicatorIcon} size={20} color={indicatorColor} /> : null}
              </View>
              <TextInput
                value={raw}
                onChangeText={(text) => onChange(item.row_id, text)}
                placeholder={`Actual count (${item.uom ?? 'qty'})`}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                editable={!disabled}
                style={{
                  marginTop: spacing.sm - 2,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: borderRadius.sm,
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: spacing.sm - 2,
                  fontSize: fontSize.md,
                  color: COLORS.text,
                  backgroundColor: COLORS.surfaceAlt,
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
