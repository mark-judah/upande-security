import api from './client';
import type { TractorDailyTask } from './types';

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
