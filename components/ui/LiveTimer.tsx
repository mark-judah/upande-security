import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

type Props = {
  entryTime: Date;
  compact?: boolean;
};

export function LiveTimer({ entryTime, compact }: Props) {
  const [elapsed, setElapsed] = useState(() => Date.now() - entryTime.getTime());

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - entryTime.getTime()), 1000);
    return () => clearInterval(id);
  }, [entryTime]);

  const h = Math.floor(elapsed / 3_600_000);
  const m = Math.floor((elapsed / 60_000) % 60);
  const s = Math.floor((elapsed / 1000) % 60);
  const label =
    h > 0
      ? `${h}h ${String(m).padStart(2, '0')}m`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.text,
        borderRadius: borderRadius.full,
        paddingHorizontal: compact ? spacing.sm : spacing.sm + 2,
        paddingVertical: compact ? 2 : spacing.xs,
      }}
    >
      <Ionicons name="timer-outline" size={compact ? 12 : 14} color={COLORS.textOnPrimary} />
      <Text
        style={{
          color: COLORS.textOnPrimary,
          fontSize: compact ? fontSize.xs : fontSize.sm,
          fontFamily: fontFamily.bold,
          marginLeft: spacing.xs,
          fontVariant: ['tabular-nums'],
        }}
      >
        {label}
      </Text>
    </View>
  );
}
