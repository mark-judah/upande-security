import { withLayoutContext, router } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, Alert, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/stores/authStore';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

export default function GateLayout() {
  const logout = useAuthStore((s) => s.logout);
  const userEmail = useAuthStore((s) => s.user?.email);

  const confirmLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#000000' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={require('../../../../assets/images/upande_logo.png')}
            style={{ width: 26, height: 26 }}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
            Upande Security
          </Text>
          {userEmail ? (
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{userEmail}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={confirmLogout}
          hitSlop={12}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <MaterialIcons name="logout" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <MaterialTopTabs
        screenOptions={{
          tabBarStyle: { backgroundColor: '#000000', elevation: 0, shadowOpacity: 0 },
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
          tabBarIndicatorStyle: { backgroundColor: '#FFFFFF', height: 3 },
          tabBarLabelStyle: { fontWeight: '600', fontSize: 13 },
        }}
      >
        <MaterialTopTabs.Screen name="index" options={{ title: 'Gate' }} />
        <MaterialTopTabs.Screen name="summary" options={{ title: 'Summary' }} />
      </MaterialTopTabs>
    </SafeAreaView>
  );
}
