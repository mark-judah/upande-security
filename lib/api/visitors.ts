import api from './client';
import type { Appointment, VisitorAppointmentSearchResult } from './types';

export async function fetchVisitorAppointment(query: string) {
  const res = await api.post<{ message: VisitorAppointmentSearchResult }>(
    '/api/method/getVisitorAppointment',
    { query },
  );
  return res.data.message;
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
