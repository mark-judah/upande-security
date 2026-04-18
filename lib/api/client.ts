import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const api = axios.create({ timeout: 30000 });

api.interceptors.request.use(async (config) => {
  const baseURL = await AsyncStorage.getItem('instanceurl');
  const cookie = await AsyncStorage.getItem('cookie');
  if (!baseURL) throw new Error('No instance URL configured');
  if (!cookie) throw new Error('Authentication Error: No cookies found');

  config.baseURL = baseURL;
  config.headers.Cookie = cookie;
  config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json';
  config.headers['X-Frappe-CSRF-Token'] = 'token';
  return config;
});

function extractFrappeError(err: AxiosError): string {
  const data = err.response?.data as
    | { _server_messages?: string; exception?: string; exc?: string; message?: string }
    | undefined;
  if (data) {
    if (typeof data._server_messages === 'string') {
      try {
        const parsed = JSON.parse(data._server_messages) as string[];
        const first = parsed[0];
        if (first) {
          try {
            const obj = JSON.parse(first) as { message?: string };
            if (obj?.message) return obj.message;
          } catch {
            return first;
          }
        }
      } catch {
        // fall through
      }
    }
    if (typeof data.exception === 'string' && data.exception) {
      const line = data.exception.split('\n').pop()?.trim();
      if (line) return line;
    }
    if (typeof data.message === 'string' && data.message) return data.message;
  }
  if (err.response?.status) {
    return `Request failed (${err.response.status})`;
  }
  return err.message || 'Network error';
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      await AsyncStorage.multiRemove(['cookie']);
      router.replace('/login');
    }
    if (__DEV__ && err.response) {
      console.warn(
        '[api error]',
        err.config?.method?.toUpperCase(),
        err.config?.url,
        err.response.status,
        err.response.data,
      );
    }
    const message = extractFrappeError(err);
    return Promise.reject(new Error(message));
  },
);

export default api;
