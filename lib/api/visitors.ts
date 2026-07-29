import api from './client';
import type { Appointment, VisitorAppointmentSearchResult, VisitorHistoryResult } from './types';

export async function fetchVisitorAppointment(query: string) {
  const res = await api.post<{ message: VisitorAppointmentSearchResult }>(
    '/api/method/getVisitorAppointment',
    { query },
  );
  return res.data.message;
}

/**
 * For a walk-in visitor with no appointment scheduled today, look up their
 * most recent PAST visit (matched by phone/name) so the form can be
 * prefilled instead of re-entered from scratch. Never throws — a lookup
 * failure just falls back to a blank walk-in form.
 */
export async function fetchVisitorHistory(query: string): Promise<VisitorHistoryResult> {
  const q = query.trim();
  if (!q) return { found: false };
  try {
    const res = await api.post<{ message: VisitorHistoryResult }>('/api/method/getVisitorHistory', {
      query: q,
    });
    return res.data.message ?? { found: false };
  } catch {
    return { found: false };
  }
}

export async function fetchAppointmentDoc(name: string) {
  const res = await api.get<{ data: Appointment }>(
    `/api/resource/Appointment/${encodeURIComponent(name)}`,
  );
  return res.data.data;
}

export async function setAppointmentClosed(name: string) {
  const res = await api.put<{ data: Appointment }>(
    `/api/resource/Appointment/${encodeURIComponent(name)}`,
    { status: 'Closed' },
  );
  return res.data.data;
}

export type UpdateAppointmentStatusInput = {
  name: string;
  custom_mode_of_transport?: string;
  custom_vehicles_number_plate?: string;
  custom_vehicles_colour?: string;
  custom_reporting_status?: string;
  custom_check_in_time?: string;
  custom_check_out_time?: string;
};

export async function updateAppointmentStatus({ name, ...body }: UpdateAppointmentStatusInput) {
  const res = await api.put<{ data: Appointment }>(
    `/api/resource/Appointment/${encodeURIComponent(name)}`,
    body,
  );
  return res.data.data;
}

export type CreateAppointmentInput = {
  customer_name: string;
  customer_phone_number?: string;
  customer_email?: string;
  custom_meet_with?: string;
  custom_visitor_type?: 'Visitor' | 'Staff' | 'Contractor' | 'Customer';
  scheduled_time?: string;
  customer_details?: string;
  custom_mode_of_transport?: string;
  custom_vehicles_number_plate?: string;
  custom_vehicles_colour?: string;
  custom_number_of_passengers?: number;
};

export async function createAppointment(input: CreateAppointmentInput) {
  const res = await api.post<{ data: Appointment }>('/api/resource/Appointment', {
    ...input,
    status: 'Open',
  });
  return res.data.data;
}
