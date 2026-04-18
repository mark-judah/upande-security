import { ActivityIndicator, View } from 'react-native';

export function Loader() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
      }}
    >
      <ActivityIndicator size="large" color="white" />
    </View>
  );
}
