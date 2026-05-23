// Thin shim over the server-script verbs in lib/services/api.ts.
import { api } from '@/lib/services/api';
import type { TractorDailyTask } from './types';

export type TractorTaskSearchResult = Pick<
  TractorDailyTask,
  'name' | 'motor_vehicle' | 'farm' | 'operator'
> & {
  workflow_state?: string;
  date?: string;
};

export async function searchTractorDailyTasks(
  query: string,
): Promise<TractorTaskSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const hits = await api.searchVehicleTickets(q);
  return hits.map((h) => ({
    name: h.name,
    motor_vehicle: h.motor_vehicle,
    farm: h.farm,
    operator: h.operator,
    workflow_state: h.workflow_state,
    date: h.date,
  }));
}

export async function fetchTractorDailyTask(name: string): Promise<TractorDailyTask> {
  const ticket = await api.getVehicleTicket(name);
  return ticket as unknown as TractorDailyTask;
}

export async function markTractorTaskRowCompleted(
  ticketName: string,
  taskRowName?: string,
): Promise<void> {
  await api.markVehicleTaskCompleted(ticketName, taskRowName);
}
