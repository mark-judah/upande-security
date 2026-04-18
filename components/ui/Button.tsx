import { Pressable, PressableProps, Text } from 'react-native';

type Props = PressableProps & { label: string };

export function Button({ label, ...rest }: Props) {
  return (
    <Pressable {...rest}>
      <Text>{label}</Text>
    </Pressable>
  );
}
