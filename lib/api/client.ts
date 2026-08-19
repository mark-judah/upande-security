import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const api = axios.create({ timeout: 30000 });

api.interceptors.request.use(async (config) => {
  const baseURL = await AsyncStorage.getItem('instanceurl');
  const cookie = await AsyncStorage.getItem('cookie');

  // Same recovery as a real 401/403 (see the response interceptor below) —
  // previously this just threw a raw string and dead-ended, leaving
  // whoever hit it stuck on whatever screen they were on with an error
  // toast and no way forward except manually navigating back to /login.
  // Missing baseURL/cookie means the exact same thing a 401 means (no
  // valid session), so route there the same way instead of surfacing a
  // one-off error shape nothing else in the app expects.
  if (!baseURL || !cookie) {
    await AsyncStorage.multiRemove(['cookie']);
    router.replace('/login');
    return Promise.reject(new Error(!baseURL ? 'No instance URL configured' : 'Session expired — please log in again'));
  }

  config.baseURL = baseURL;
  config.headers.Cookie = cookie;
  config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json';
  config.headers['X-Frappe-CSRF-Token'] = 'token';

  if (__DEV__) {
    const method = config.method?.toUpperCase() ?? 'GET';
    const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
    console.log('[api →]', method, url, config.params ?? '', config.data ?? '');
  }
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
  (r) => {
    if (__DEV__) {
      console.log(
        '[api ←]',
        r.config.method?.toUpperCase(),
        r.config.url,
        r.status,
        r.data,
      );
    }
    return r;
  },
  async (err: AxiosError) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      await AsyncStorage.multiRemove(['cookie']);
      router.replace('/login');
    }
    if (__DEV__) {
      console.warn(
        '[api ✗]',
        err.config?.method?.toUpperCase(),
        err.config?.url,
        err.response?.status ?? 'NO_RESPONSE',
        err.response?.data ?? err.message,
      );
    }
    const message = extractFrappeError(err);
    return Promise.reject(new Error(message));
  },
);

export default api;
