import { ScrollView } from 'react-native';
import { ChoiceChip } from '@/components/ui/ChoiceChip';
import { CheckInType, CHECK_IN_TYPE_LABELS } from '@/constants/checkInTypes';

type Props = {
  selected: CheckInType;
  onSelect: (t: CheckInType) => void;
};

const TYPES: CheckInType[] = [
  CheckInType.Visitor,
  CheckInType.Staff,
  CheckInType.Contractor,
  CheckInType.CompanyVehicle,
];

export function HeaderSelectors({ selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
    >
      {TYPES.map((t) => (
        <ChoiceChip
          key={t}
          label={CHECK_IN_TYPE_LABELS[t]}
          selected={selected === t}
          onPress={() => onSelect(t)}
        />
      ))}
    </ScrollView>
  );
}
