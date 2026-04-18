import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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
        backgroundColor: '#000000',
        borderRadius: 999,
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 2 : 4,
      }}
    >
      <MaterialIcons name="timer" size={compact ? 12 : 14} color="#FFFFFF" />
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: compact ? 11 : 13,
          fontWeight: '700',
          marginLeft: 4,
          fontVariant: ['tabular-nums'],
        }}
      >
        {label}
      </Text>
    </View>
  );
}
