import api from './client';

export type PatrolGpsPayload = {
  client_id: string;
  patrol_tag: string;
  guard: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string;
};

export type PatrolGpsResult = {
  status: 'success' | 'error';
  name?: string;
  patrol_tag?: string;
  captured_at?: string;
  duplicate?: boolean;
  message?: string;
};

// The Frappe Server Script writes its result to frappe.response["message"],
// which becomes { "message": [...] } in the HTTP body.
const METHOD = '/api/method/submitPatrolPoints';

export async function uploadPatrolGps(
  payload: PatrolGpsPayload[],
): Promise<PatrolGpsResult[]> {
  const res = await api.post<Record<string, unknown>>(
    METHOD,
    JSON.stringify(payload),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (__DEV__) {
    // Dump the raw response so we can see the actual wrapper shape Frappe returns.
    console.log('[uploadPatrolGps] status', res.status, 'body', JSON.stringify(res.data));
  }
  const body = res.data ?? {};
  // Frappe Server Scripts conventionally use "message"; some configurations
  // surface results under "data". Accept either.
  const list =
    (body as { message?: PatrolGpsResult[] }).message ??
    (body as { data?: PatrolGpsResult[] }).data ??
    [];
  return Array.isArray(list) ? list : [];
}
