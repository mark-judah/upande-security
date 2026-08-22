import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const api = axios.create({ timeout: 30000 });

api.interceptors.request.use(async (config) => {
  const baseURL = await AsyncStorage.getItem('instanceurl');
  const cookie = await AsyncStorage.getItem('cookie');
  if (!baseURL || !cookie) {
    // Mirrors the response interceptor's 401/403 recovery below - a
    // missing cookie is a dead end otherwise, the user just sees a raw
    // "No cookies found" error with no way forward short of force-quitting.
    await AsyncStorage.multiRemove(['cookie']);
    router.replace('/login');
    return Promise.reject(
      new Error(!baseURL ? 'No instance URL configured' : 'Session expired — please log in again'),
    );
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
