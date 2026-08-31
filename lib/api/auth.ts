import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@preeternal/react-native-cookie-manager';
import { getWorkingUrl } from '@/lib/utils/url';

function parseCookie(setCookieHeader: string | null, name: string): string | null {
  if (!setCookieHeader) return null;
  const re = new RegExp(`(?:^|[;,\\s])${name}=([^;,\\s]+)`);
  const match = re.exec(setCookieHeader);
  return match ? match[1] : null;
}

export async function login(email: string, password: string, urlInput: string) {
  const fullUrl = await getWorkingUrl(urlInput);
  if (!fullUrl) {
    throw new Error(
      `Could not reach "${urlInput}". Check the URL, your network, and that the Frappe instance is online.`,
    );
  }

  const body = new URLSearchParams();
  body.append('usr', email);
  body.append('pwd', password);

  const response = await fetch(`${fullUrl}/api/method/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    let msg = `Login failed (${response.status})`;
    try {
      const data = await response.json();
      msg = data?.message ?? data?.exc ?? msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  // React Native's fetch does NOT reliably expose the Set-Cookie response
  // header to JS — the native networking layer (OkHttp on Android,
  // NSURLSession on iOS) consumes it straight into the platform's own
  // cookie jar and strips it before `response.headers` ever sees it. Read
  // the cookie back from that native jar instead of trying to parse it out
  // of the fetch response, which is the thing that was actually failing
  // here (login genuinely succeeds server-side; the app just couldn't see
  // proof of it). response.headers.get('set-cookie') is kept as a
  // best-effort fallback only, for whatever RN/platform combination might
  // still expose it.
  const jar = await CookieManager.get(fullUrl);
  let sid: string | null = jar.sid?.value ?? null;
  let userId: string | null = jar.user_id?.value ?? null;
  if (!sid) {
    const setCookie = response.headers.get('set-cookie');
    sid = parseCookie(setCookie, 'sid');
    userId = userId ?? parseCookie(setCookie, 'user_id');
  }
  if (!sid) throw new Error('Login succeeded but no session cookie returned');

  await AsyncStorage.setItem('instanceurl', fullUrl);
  await AsyncStorage.setItem('cookie', `sid=${sid}; user_id=${userId ?? ''}`);
  await AsyncStorage.setItem('user_email', email);

  let message: string | undefined;
  try {
    const data = await response.json();
    message = data?.message;
  } catch {
    // ignore
  }

  return { fullUrl, sid, userId: userId ?? '', message };
}

/**
 * Roles drive visibility of the role-gated Approvals tab (Secretary /
 * Department Head). Best-effort — an empty list just hides the tab rather
 * than blocking login.
 */
export async function fetchUserRoles(instanceUrl: string, email: string): Promise<string[]> {
  try {
    const cookie = await AsyncStorage.getItem('cookie');
    const res = await fetch(
      `${instanceUrl}/api/resource/User/${encodeURIComponent(email)}?fields=["roles"]`,
      { headers: { Cookie: cookie ?? '' } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const roles: string[] = (data?.data?.roles ?? []).map((r: any) => r.role as string);
    return roles;
  } catch {
    return [];
  }
}

// Soft logout — intentional no-op at the API layer.
//
// Storage cleanup is owned by `authStore.forgetDevice` (the hard path). The
// soft path (`authStore.logout`) deliberately preserves the cookie, instance
// URL, biometric flag, and cached email in AsyncStorage so that the login
// screen pre-fills URL + email on return and the biometric quick-unlock FAB
// stays available (it requires cookie + biometric_enabled both present).
export async function logout() {
  // no-op
}
