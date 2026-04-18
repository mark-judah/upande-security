import { Text, TouchableOpacity } from 'react-native';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function ChoiceChip({ label, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#000000',
        backgroundColor: selected ? '#000000' : '#FFFFFF',
        marginRight: 8,
      }}
    >
      <Text
        style={{
          color: selected ? '#FFFFFF' : '#000000',
          fontWeight: '600',
          fontSize: 12,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
