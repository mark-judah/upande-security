// Thin shim over the server-script verbs in lib/services/api.ts.
// The daily_summary script does the aggregation server-side.
import { api } from '@/lib/services/api';
import type { Appointment, DailySummary } from './types';

function toFrappeDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function fetchDailySummary({ date }: { date: Date }): Promise<DailySummary> {
  const result = await api.dailySummary(toFrappeDate(date));
  return {
    total_checked_in: result.total_checked_in,
    total_checked_out: result.total_checked_out,
    still_inside: result.still_inside,
    still_inside_list: result.still_inside_list as unknown as Appointment[],
    all: result.all as unknown as Appointment[],
  };
}
