// Thin shim over the server-script verbs in lib/services/api.ts.
// All visitor flows go through Frappe server scripts — never /api/resource directly.
import { api } from '@/lib/services/api';
import type { Appointment, VisitorAppointmentSearchResult } from './types';

export async function fetchVisitorAppointment(
  query: string,
): Promise<VisitorAppointmentSearchResult> {
  const result = await api.searchVisitorAppointment(query);
  if (!result.has_appointment) {
    return { has_appointment: false };
  }
  return {
    has_appointment: true,
    visitor_name: result.visitor_name,
    id_no: result.id_no,
    phone_number: result.phone_number,
    organization: result.organization,
    host_name: result.host_name,
    scheduled_time: result.scheduled_time,
    purpose: result.purpose,
    transport_mode: result.transport_mode as Appointment['custom_mode_of_transport'],
    vehicle_reg_no: result.vehicle_reg_no,
    vehicle_color: result.vehicle_color,
    name: result.name,
    status: result.status,
  };
}

export async function fetchAppointmentDoc(name: string): Promise<Appointment> {
  const doc = await api.getAppointment(name);
  return doc as unknown as Appointment;
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

export async function createWalkInAppointment(input: CreateAppointmentInput) {
  return api.createWalkIn({
    customer_name: input.customer_name,
    phone: input.customer_phone_number ?? '',
    host: input.custom_meet_with ?? '',
    email: input.customer_email,
    purpose: input.customer_details,
    transport: input.custom_mode_of_transport,
    plate: input.custom_vehicles_number_plate,
    colour: input.custom_vehicles_colour,
    passengers: input.custom_number_of_passengers,
    scheduled_time: input.scheduled_time,
  });
}
