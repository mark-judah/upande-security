import api from './client';
import type { ContractorSearchResult, ContractorVehicle } from './types';

/**
 * Search for a contractor via the dedicated server script.
 * Returns a rich result including approval status, registered vehicles,
 * and access-window dates.  Never throws — UI handles the empty state.
 */
export async function fetchContractorContract(query: string): Promise<ContractorSearchResult> {
  const q = query.trim();
  if (!q) return {};

  try {
    const res = await api.post<{ message: ContractorSearchResult }>(
      '/api/method/getContractorContract',
      { query: q },
    );
    return res.data.message ?? {};
  } catch {
    return {};
  }
}

export type ContractorCheckInInput = {
  // Identity — at least one of contractor_ref or contractor_name must be set.
  contractor_ref?: string;   // Supplier name for the approved-contractor path
  contractor_name?: string;  // Used for Appointment.customer_name
  phone?: string;
  company?: string;
  purpose?: string;
  // Transport / vehicle
  transport_mode?: 'On Foot' | 'Vehicle' | 'Motor Bike' | string;
  number_plate?: string;
  vehicle_color?: string;
  passengers?: number;
};

/**
 * Contractor check-in — always goes through the dedicated server script,
 * which creates the Appointment server-side using db.set_value + ignore_validate
 * so that custom_meet_with's Link-to-Employee validator can't reject contractor
 * appointments (contractors aren't Employees).
 *
 * Handles BOTH paths:
 *   1. Approved contractor (Supplier matched) — pass contractor_ref + optional vehicle
 *   2. Walk-in contractor — pass contractor_name + phone + purpose
 */
export async function contractorCheckIn(input: ContractorCheckInInput) {
  const params = new URLSearchParams();
  if (input.contractor_ref) params.append('contractor_ref', input.contractor_ref);
  if (input.contractor_name) params.append('contractor_name', input.contractor_name);
  if (input.phone) params.append('phone', input.phone);
  if (input.company) params.append('company', input.company);
  if (input.purpose) params.append('purpose', input.purpose);
  if (input.transport_mode) params.append('transport_mode', input.transport_mode);
  if (input.number_plate) params.append('number_plate', input.number_plate);
  if (input.vehicle_color) params.append('vehicle_color', input.vehicle_color);
  if (input.passengers != null) params.append('passengers', String(input.passengers));

  if (__DEV__) {
    console.log('[contractorCheckIn] → POST /api/method/contractor_gate_checkin', {
      params: Object.fromEntries(params.entries()),
    });
  }

  try {
    const res = await api.post<{
      message: { success: boolean; appointment_name: string; check_in_time: string };
    }>(
      '/api/method/contractor_gate_checkin',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    if (__DEV__) {
      console.log('[contractorCheckIn] ← response', res.data);
    }
    return res.data.message;
  } catch (e: any) {
    if (__DEV__) {
      console.log(
        '[contractorCheckIn] ✗ error',
        e?.response?.status,
        e?.response?.data ?? e?.message,
      );
    }
    throw e;
  }
}

/**
 * Contractor check-out — uses the dedicated contractor_gate_checkout script
 * to avoid the workflow path entirely (the contractor record may not be in a
 * workflow state that exposes a Check Out transition).
 */
export async function contractorCheckOut(appointmentName: string) {
  const params = new URLSearchParams();
  params.append('appointment_name', appointmentName);

  const res = await api.post<{ message: { success: boolean; check_out_time: string } }>(
    '/api/method/contractor_gate_checkout',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return res.data.message;
}

export type { ContractorVehicle };

export async function addVehicleToSupplier(
  supplierName: string,
  vehicle: { number_plate: string; colour?: string; vehicle_type?: string },
): Promise<{ success: boolean; already_exists: boolean }> {
  const params = new URLSearchParams();
  params.append('supplier_name', supplierName);
  params.append('number_plate', vehicle.number_plate);
  if (vehicle.colour) params.append('colour', vehicle.colour);
  if (vehicle.vehicle_type) params.append('vehicle_type', vehicle.vehicle_type);

  const res = await api.post<{ message: { success: boolean; already_exists: boolean } }>(
    '/api/method/add_contractor_vehicle',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return res.data.message;
}
