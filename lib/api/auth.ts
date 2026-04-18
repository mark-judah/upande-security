import AsyncStorage from '@react-native-async-storage/async-storage';
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

  const setCookie = response.headers.get('set-cookie');
  const sid = parseCookie(setCookie, 'sid');
  const userId = parseCookie(setCookie, 'user_id');
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

export async function logout() {
  await AsyncStorage.multiRemove(['instanceurl', 'cookie', 'user_email']);
}
