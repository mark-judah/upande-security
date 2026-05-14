import { Stack } from 'expo-router';

export default function PatrolLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="active" />
    </Stack>
  );
}
