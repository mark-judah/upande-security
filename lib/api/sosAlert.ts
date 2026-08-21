// Shim for the two upande_security "nearby guard SOS alert" endpoints.
//
// Unlike every other verb in this app (see lib/services/api.ts), these are
// real whitelisted Frappe *app methods* on the upande_security app we control
// end-to-end — not safe-exec Server Scripts — so they're called by their full
// dotted path instead of the flat snake_case verb convention, and they don't
// go through lib/services/api.ts's `call<T>` helper. They follow the same
// soft-fail-on-`{error}` contract though, so we replicate that check here.
import client from './client';

function unwrap<T>(message: T | { error?: string }): T {
  if (
    message &&
    typeof message === 'object' &&
    'error' in message &&
    (message as { error?: string }).error
  ) {
    throw new Error((message as { error: string }).error);
  }
  return message as T;
}

export type RegisterPushTokenInput = {
  expo_push_token: string;
  platform?: 'ios' | 'android';
  lat?: number;
  lng?: number;
};
export type RegisterPushTokenResult = { registered: true; name: string };

export async function registerPushToken(
  input: RegisterPushTokenInput,
): Promise<RegisterPushTokenResult> {
  const res = await client.post<{ message: RegisterPushTokenResult | { error: string } }>(
    '/api/method/upande_security.api.sos_alert.register_push_token',
    input,
  );
  return unwrap<RegisterPushTokenResult>(res.data.message);
}

export type TriggerNearbyGuardAlertInput = {
  latitude: number;
  longitude: number;
  incident_name?: string;
};
export type NearbyGuardHit = { guard_name: string; distance_m: number };
export type TriggerNearbyGuardAlertResult = {
  alerted: number;
  guards: NearbyGuardHit[];
  push_result: unknown;
};

export async function triggerNearbyGuardAlert(
  input: TriggerNearbyGuardAlertInput,
): Promise<TriggerNearbyGuardAlertResult> {
  const res = await client.post<{ message: TriggerNearbyGuardAlertResult | { error: string } }>(
    '/api/method/upande_security.api.sos_alert.trigger_nearby_guard_alert',
    input,
  );
  return unwrap<TriggerNearbyGuardAlertResult>(res.data.message);
}

// Lightweight periodic location keep-alive for any logged-in user who isn't
// actively being tracked by the full patrol-GPS pipeline (see
// lib/services/locationPing.ts). Just two numbers, no batching, no offline
// queue -- this only needs to be "fresh enough" for nearby-guard SOS lookup,
// not survey-grade.
export type PingLocationInput = { lat: number; lng: number };
export type PingLocationResult = { ok: true };

export async function pingLocation(input: PingLocationInput): Promise<PingLocationResult> {
  const res = await client.post<{ message: PingLocationResult | { error: string } }>(
    '/api/method/upande_security.api.sos_alert.ping_location',
    input,
  );
  return unwrap<PingLocationResult>(res.data.message);
}
