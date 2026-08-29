// Thin shim over the server-script verbs in lib/services/api.ts.
// The server scripts compute hours and submit (docstatus=1) — the client
// doesn't fetch/mutate the Timesheet doc directly anymore.
import { api } from '@/lib/services/api';
import type { Timesheet, TractorDailyTask } from './types';

export async function createGateTimesheet(params: {
  ticket: TractorDailyTask;
  entryTime: string;
  entryGate?: string | null;
}): Promise<Timesheet> {
  const result = await api.createGateTimesheet(
    params.ticket.name,
    params.entryTime,
    params.entryGate ?? undefined,
  );
  return result as unknown as Timesheet;
}

export async function submitGateTimesheet(params: {
  name: string;
  exitTime: string;
  completionNote: string;
  exitGate?: string | null;
}): Promise<Timesheet> {
  const result = await api.submitGateTimesheet(
    params.name,
    params.exitTime,
    params.completionNote,
    params.exitGate ?? undefined,
  );
  return result as unknown as Timesheet;
}
