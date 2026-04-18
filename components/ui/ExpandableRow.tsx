import { ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import Collapsible from 'react-native-collapsible';

type Props = {
  header: ReactNode;
  children: ReactNode;
};

export function ExpandableRow({ header, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen((v) => !v)}>{header}</Pressable>
      <Collapsible collapsed={!open}>
        <View>{children}</View>
      </Collapsible>
    </View>
  );
}
