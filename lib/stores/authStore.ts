import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, logout as apiLogout } from '@/lib/api/auth';

type AuthState = {
  user: { email: string; userId: string } | null;
  instanceUrl: string | null;
  isAuthenticated: boolean;
  hydrate: () => Promise<void>;
  login: (url: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  instanceUrl: null,
  isAuthenticated: false,
  hydrate: async () => {
    const [email, url, cookie] = await Promise.all([
      AsyncStorage.getItem('user_email'),
      AsyncStorage.getItem('instanceurl'),
      AsyncStorage.getItem('cookie'),
    ]);
    set({
      user: email ? { email, userId: '' } : null,
      instanceUrl: url,
      isAuthenticated: Boolean(cookie && url),
    });
  },
  login: async (url, email, password) => {
    const result = await apiLogin(email, password, url);
    set({
      user: { email, userId: result.userId ?? '' },
      instanceUrl: result.fullUrl,
      isAuthenticated: true,
    });
  },
  logout: async () => {
    await apiLogout();
    set({ user: null, instanceUrl: null, isAuthenticated: false });
  },
}));
