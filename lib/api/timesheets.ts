import api from './client';
import type { Timesheet, TractorDailyTask } from './types';
import { toFrappeDateTime } from '@/lib/utils/date';

function toFrappeDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseFrappeDateTime(s: string): Date {
  // "YYYY-MM-DD HH:MM:SS" — Hermes parses this unevenly; normalize to ISO.
  return new Date(s.replace(' ', 'T'));
}

export async function createGateTimesheet(params: {
  ticket: TractorDailyTask;
  entryTime: string;
}): Promise<Timesheet> {
  const { ticket, entryTime } = params;
  const firstTask = ticket.task?.[0];

  // Provisional 1-hour window so Frappe's hours>0 validation passes;
  // the real to_time is written on check-out.
  const provisionalEnd = new Date(parseFrappeDateTime(entryTime).getTime() + 60 * 60 * 1000);

  const body = {
    naming_series: 'TS-.YYYY.-',
    company: ticket.company,
    employee: ticket.custom_employee,
    custom_asset: ticket.motor_vehicle,
    start_date: toFrappeDate(),
    end_date: toFrappeDate(),
    time_logs: [
      {
        activity_type: firstTask?.activity_type ?? ticket.erp_task ?? 'Transport',
        from_time: entryTime,
        to_time: toFrappeDateTime(provisionalEnd),
        hours: 1,
        expected_hours: 1,
        description: firstTask?.description ?? '',
        task: ticket.erp_task ?? firstTask?.activity_type,
        is_billable: 1,
        completed: 0,
      },
    ],
  };

  const res = await api.post<{ data: Timesheet }>('/api/resource/Timesheet', body);
  return res.data.data;
}

export async function fetchTimesheet(name: string): Promise<Timesheet> {
  const res = await api.get<{ data: Timesheet }>(
    `/api/resource/Timesheet/${encodeURIComponent(name)}`,
  );
  return res.data.data;
}

export async function submitGateTimesheet(params: {
  name: string;
  exitTime: string;
  completionNote: string;
}): Promise<Timesheet> {
  const { name, exitTime, completionNote } = params;
  const doc = await fetchTimesheet(name);

  if (doc.time_logs?.length) {
    const row = doc.time_logs[0];
    const fromDate = parseFrappeDateTime(row.from_time);
    const toDate = parseFrappeDateTime(exitTime);
    const hours = Math.max(0.01, (toDate.getTime() - fromDate.getTime()) / 3_600_000);
    row.to_time = exitTime;
    row.hours = Number(hours.toFixed(4));
    row.expected_hours = Number(hours.toFixed(4));
    row.description = completionNote;
    row.completed = 1;
  }
  doc.docstatus = 1;

  const res = await api.post<{ message: Timesheet }>('/api/method/frappe.client.submit', {
    doc: JSON.stringify(doc),
  });
  return res.data.message;
}
