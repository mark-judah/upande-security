import api from './client';
import type { TractorDailyTask } from './types';

export type TractorTaskSearchResult = Pick<
  TractorDailyTask,
  'name' | 'motor_vehicle' | 'farm' | 'operator'
> & {
  workflow_state?: string;
  date?: string;
};

export async function searchTractorDailyTasks(query: string) {
  const q = query.trim();
  if (!q) return [];
  const filters = encodeURIComponent(
    JSON.stringify([['Tractor Daily Task', 'name', 'like', `%${q}%`]]),
  );
  // Only standard + "In List View" fields are allowed in Frappe's list query.
  // custom_gate_status is read on the detail endpoint instead.
  const fields = encodeURIComponent(
    JSON.stringify(['name', 'motor_vehicle', 'farm', 'operator', 'workflow_state', 'date']),
  );
  const res = await api.get<{ data: TractorTaskSearchResult[] }>(
    `/api/resource/Tractor Daily Task?filters=${filters}&fields=${fields}&limit_page_length=20&order_by=modified desc`,
  );
  return res.data.data;
}

export async function fetchTractorDailyTask(name: string) {
  const res = await api.get<{ data: TractorDailyTask }>(
    `/api/resource/Tractor Daily Task/${encodeURIComponent(name)}`,
  );
  return res.data.data;
}

export async function recordTractorGateEntry(input: {
  name: string;
  entryTime: string;
  farm?: string;
}) {
  const res = await api.put<{ data: TractorDailyTask }>(
    `/api/resource/Tractor Daily Task/${encodeURIComponent(input.name)}`,
    {
      custom_gate_entry_time: input.entryTime,
      custom_gate_entry_farm: input.farm,
      custom_gate_status: 'Inside',
    },
  );
  return res.data.data;
}

export async function recordTractorGateExit(input: {
  name: string;
  exitTime: string;
  completionNote: string;
}) {
  const res = await api.put<{ data: TractorDailyTask }>(
    `/api/resource/Tractor Daily Task/${encodeURIComponent(input.name)}`,
    {
      custom_gate_exit_time: input.exitTime,
      custom_completion_note: input.completionNote,
      custom_gate_status: 'Exited',
    },
  );
  return res.data.data;
}

export async function updateTractorDailyTask(input: {
  name: string;
  data: Partial<TractorDailyTask>;
}) {
  const res = await api.put<{ data: TractorDailyTask }>(
    `/api/resource/Tractor Daily Task/${encodeURIComponent(input.name)}`,
    input.data,
  );
  return res.data.data;
}

export async function markTractorTaskRowCompleted(
  ticketName: string,
  taskRowName?: string,
): Promise<void> {
  const ticket = await fetchTractorDailyTask(ticketName);
  if (!ticket.task?.length) return;

  const row = taskRowName
    ? ticket.task.find((t) => t.name === taskRowName)
    : ticket.task[0];
  if (!row) return;
  row.completed = 1;

  await api.put<{ data: TractorDailyTask }>(
    `/api/resource/Tractor Daily Task/${encodeURIComponent(ticketName)}`,
    { task: ticket.task },
  );
}
