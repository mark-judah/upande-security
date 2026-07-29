// Thin shim over the server-script verbs in lib/services/api.ts.
import { api } from '@/lib/services/api';

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

export async function uploadPatrolGps(
  payload: PatrolGpsPayload[],
): Promise<PatrolGpsResult[]> {
  const result = await api.submitPatrolPoints(
    payload.map((p) => ({
      patrol_tag: p.patrol_tag,
      guard: p.guard,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy,
      captured_at: p.captured_at,
    })),
  );
  return result ?? [];
}
