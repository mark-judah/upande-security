import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';

const api = axios.create({ timeout: 30000 });

api.interceptors.request.use(async (config) => {
  const baseURL = await AsyncStorage.getItem('instanceurl');
  const cookie = await AsyncStorage.getItem('cookie');
  if (!baseURL || !cookie) {
    // Mirrors the response interceptor's 401/403 recovery below - a
    // missing cookie is a dead end otherwise, the user just sees a raw
    // "No cookies found" error with no way forward short of force-quitting.
    //
    // Clearing AsyncStorage alone isn't enough: the root layout's auth-gate
    // effect (app/_layout.tsx) decides whether to redirect based on
    // authStore's in-memory `hasSession`, not on AsyncStorage directly. If
    // this only clears storage, `hasSession` stays stale-true, and the
    // moment router.replace('/login') lands on the login route, that same
    // effect sees hasSession===true && segments[0]==='login' and bounces
    // straight back — the screen blinks and lands back on the home tab
    // instead of actually reaching the login screen, and every subsequent
    // action repeats the same loop since the session was never really
    // cleared. forgetDevice() resets both storage AND the in-memory state
    // together, so the redirect actually sticks.
    await useAuthStore.getState().forgetDevice();
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
      // See the matching comment in the request interceptor above — must
      // reset authStore's in-memory hasSession too, not just AsyncStorage,
      // or the root layout's auth-gate effect races the redirect back to
      // home instead of actually landing on login.
      await useAuthStore.getState().forgetDevice();
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
