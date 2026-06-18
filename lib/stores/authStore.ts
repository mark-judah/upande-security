import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, logout as apiLogout, fetchUserRoles } from '@/lib/api/auth';

type AuthState = {
  user: { email: string; userId: string } | null;
  instanceUrl: string | null;
  isAuthenticated: boolean;
  roles: string[];
  hydrate: () => Promise<void>;
  login: (url: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  instanceUrl: null,
  isAuthenticated: false,
  roles: [],
  hydrate: async () => {
    const [email, url, cookie, rolesJson] = await Promise.all([
      AsyncStorage.getItem('user_email'),
      AsyncStorage.getItem('instanceurl'),
      AsyncStorage.getItem('cookie'),
      AsyncStorage.getItem('user_roles'),
    ]);
    set({
      user: email ? { email, userId: '' } : null,
      instanceUrl: url,
      isAuthenticated: Boolean(cookie && url),
      roles: rolesJson ? JSON.parse(rolesJson) : [],
    });
  },
  login: async (url, email, password) => {
    const result = await apiLogin(email, password, url);
    // Fetch roles immediately after login so approval tab visibility is correct
    const roles = await fetchUserRoles(result.fullUrl, email);
    await AsyncStorage.setItem('user_roles', JSON.stringify(roles));
    set({
      user: { email, userId: result.userId ?? '' },
      instanceUrl: result.fullUrl,
      isAuthenticated: true,
      roles,
    });
  },
  logout: async () => {
    await apiLogout();
    set({ user: null, instanceUrl: null, isAuthenticated: false, roles: [] });
  },
}));
