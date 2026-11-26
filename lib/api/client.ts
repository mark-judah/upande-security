import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';
import { useFarmStore } from '@/lib/stores/farmStore';

const api = axios.create({ timeout: 30000 });

api.interceptors.request.use(async (config) => {
  const baseURL = await AsyncStorage.getItem('instanceurl');
  const cookie = await AsyncStorage.getItem('cookie');
  if (!baseURL || !cookie) {
    // Already signed out: there is no session to recover and the user is on (or
    // headed to) the login screen. Resetting the store and replacing the route
    // again here only re-mounts that screen and wipes the saved email and
    // biometric flag - and any call made while signed out would repeat it.
    if (!useAuthStore.getState().hasSession) {
      return Promise.reject(
        new Error(!baseURL ? 'No instance URL configured' : 'Not signed in'),
      );
    }
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

  // The farm a guard with no linked farm chose on the Gate tab. Sent with
  // every request; the server ignores it whenever the login has a farm.
  const chosenFarm = useFarmStore.getState().farm;
  if (chosenFarm) {
    const data = config.data;
    if (data && typeof data === 'object' && !Array.isArray(data) && !(data instanceof FormData)) {
      config.data = { ...data, checking_farm: chosenFarm };
    } else if (!data && (config.method ?? 'get').toLowerCase() === 'post') {
      config.data = { checking_farm: chosenFarm };
    } else if ((config.method ?? 'get').toLowerCase() === 'get') {
      config.params = { ...(config.params ?? {}), checking_farm: chosenFarm };
    }
  }

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

// One in-flight probe shared by every 403 that lands at once - a Command
// Center screen fires several queries together, and they all fail together.
let sessionProbe: Promise<boolean> | null = null;

/** Whether the stored cookie still belongs to a logged-in user, asked of the
 *  same get_session_info verb the app boots with. Uses plain
 *  axios, not `api`, so a 403 here cannot recurse into this interceptor. A
 *  network failure counts as alive: losing signal must never log a guard
 *  out. */
function isSessionAlive(): Promise<boolean> {
  if (!sessionProbe) {
    sessionProbe = (async () => {
      const baseURL = await AsyncStorage.getItem('instanceurl');
      const cookie = await AsyncStorage.getItem('cookie');
      if (!baseURL || !cookie) return false;
      try {
        // get_session_info is not allow_guest, so a dead session gets 401/403
        // here while any logged-in user - whatever their roles - gets a 200.
        const res = await axios.post<{ message?: { user?: string } }>(
          `${baseURL}/api/method/get_session_info`,
          {},
          {
            headers: {
              Cookie: cookie,
              'Content-Type': 'application/json',
              'X-Frappe-CSRF-Token': 'token',
            },
            timeout: 15000,
          },
        );
        const user = res.data?.message?.user;
        return Boolean(user) && user !== 'Guest';
      } catch (probeErr) {
        const s = (probeErr as AxiosError).response?.status;
        return !(s === 401 || s === 403);
      }
    })().finally(() => {
      sessionProbe = null;
    });
  }
  return sessionProbe;
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
    const status = err.response?.status;
    // Frappe answers 403 both for a dead session AND for a live user who
    // simply lacks permission on something (frappe.PermissionError). Treating
    // every 403 as "session expired" logged Security Heads out the moment a
    // Command Center screen touched a DocType their role could not read. A 401
    // is always a dead session; a 403 only is if the server no longer knows
    // who we are.
    if (
      (status === 401 || (status === 403 && !(await isSessionAlive()))) &&
      useAuthStore.getState().hasSession
    ) {
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
