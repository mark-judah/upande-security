import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckInType } from '@/constants/checkInTypes';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  selected: CheckInType;
  onSelect: (t: CheckInType) => void;
};

type TileMeta = {
  type: CheckInType;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const TILES: TileMeta[] = [
  { type: CheckInType.Visitor,        label: 'Visitor',    hint: 'Walk-in or scheduled appointment', icon: 'person-outline' },
  { type: CheckInType.Staff,          label: 'Staff',      hint: 'Employees clocking in for the day', icon: 'id-card-outline' },
  { type: CheckInType.Contractor,     label: 'Contractor', hint: 'Active supplier contract',          icon: 'construct-outline' },
  { type: CheckInType.CompanyVehicle, label: 'Vehicle',    hint: 'Scan a Tractor Daily Task ticket',   icon: 'car-outline' },
  { type: CheckInType.Dispatch,       label: 'Dispatch',   hint: 'Verify a truck against its dispatch',icon: 'clipboard-outline' },
];

export function HeaderSelectors({ selected, onSelect }: Props) {
  return (
    <View style={s.grid}>
      {TILES.map((t) => {
        const isSelected = selected === t.type;
        return (
          <Pressable
            key={t.type}
            onPress={() => onSelect(t.type)}
            style={({ pressed }) => [
              s.tile,
              isSelected && s.tileSelected,
              pressed && !isSelected && { opacity: 0.75 },
            ]}
          >
            <View style={[s.tileIcon, isSelected && s.tileIconSelected]}>
              <Ionicons
                name={t.icon}
                size={22}
                color={isSelected ? COLORS.textOnPrimary : COLORS.text}
              />
            </View>
            <Text style={[s.tileLabel, isSelected && s.tileLabelSelected]}>{t.label}</Text>
            <Text
              style={[s.tileHint, isSelected && s.tileHintSelected]}
              numberOfLines={2}
            >
              {t.hint}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 0,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    gap: spacing.xs,
  },
  tileSelected: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tileIconSelected: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tileLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: COLORS.text,
  },
  tileLabelSelected: { color: COLORS.textOnPrimary },
  tileHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  tileHintSelected: { color: 'rgba(255,255,255,0.75)' },
});
