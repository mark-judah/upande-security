const PARTIAL_CANDIDATES = (trimmed: string): string[] => {
  if (trimmed.includes('.')) {
    return [`https://${trimmed}`, `http://${trimmed}`];
  }
  return [
    `https://${trimmed}.upande.com`,
    `https://${trimmed}.frappe.cloud`,
    `https://${trimmed}`,
    `http://${trimmed}`,
  ];
};

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { method: 'GET', signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function getWorkingUrl(input: string): Promise<string | null> {
  const trimmed = input.trim().replace(/\/$/, '');
  if (!trimmed) return null;

  // Explicit full URL — trust it. The actual login POST is the real reachability test;
  // probing here just produces false negatives on slow networks or restricted endpoints.
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Partial input (e.g. "kaitet") — probe candidates in order and return the first that responds.
  const candidates = PARTIAL_CANDIDATES(trimmed);
  const tried: string[] = [];

  for (const url of candidates) {
    tried.push(url);
    try {
      await fetchWithTimeout(`${url}/api/method/ping`, 10000);
      return url;
    } catch {
      continue;
    }
  }

  if (__DEV__) {
    console.warn('[getWorkingUrl] could not reach any of:', tried);
  }
  return null;
}
