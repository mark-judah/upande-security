// Thin shim over the server-script verbs in lib/services/api.ts.
import { api } from '@/lib/services/api';
import client from '@/lib/api/client';
import type { Attendance, Employee } from './types';

function toFrappeDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function createStaffAttendance(input: {
  employee: Employee;
}): Promise<Attendance> {
  const result = await api.createStaffAttendance(input.employee.name);
  return result as unknown as Attendance;
}

export async function submitAttendance(name: string): Promise<Attendance> {
  const result = await api.submitStaffAttendance(name);
  return result as unknown as Attendance;
}

/**
 * Today's most recent submitted Attendance record for an employee, if any.
 * Used to decide whether the gate should offer CHECK IN or CHECK OUT.
 *
 * No dedicated server verb exists for this yet, so it still hits the stock
 * Frappe resource list endpoint directly via the raw client (not the
 * services/api.ts verb surface).
 */
export async function fetchTodayAttendance(employeeId: string): Promise<Attendance | null> {
  const filters = encodeURIComponent(
    JSON.stringify([
      ['Attendance', 'employee', '=', employeeId],
      ['Attendance', 'attendance_date', '=', toFrappeDate()],
      ['Attendance', 'docstatus', '=', 1],
    ]),
  );
  const fields = encodeURIComponent(
    JSON.stringify([
      'name',
      'employee',
      'in_time',
      'out_time',
      'status',
      'attendance_date',
      'custom_temp_exit_time',
    ]),
  );
  const res = await client.get<{ data: Attendance[] }>(
    `/api/resource/Attendance?filters=${filters}&fields=${fields}&order_by=creation desc&limit_page_length=1`,
  );
  return res.data.data[0] ?? null;
}

/**
 * Every submitted Attendance record for today, across all employees — used
 * to show a staff activity section on the gate Summary tab.
 */
export async function fetchTodayStaffAttendance(): Promise<Attendance[]> {
  const filters = encodeURIComponent(
    JSON.stringify([
      ['Attendance', 'attendance_date', '=', toFrappeDate()],
      ['Attendance', 'docstatus', '=', 1],
    ]),
  );
  const fields = encodeURIComponent(
    JSON.stringify([
      'name',
      'employee',
      'employee_name',
      'department',
      'in_time',
      'out_time',
      'custom_temp_exit_time',
    ]),
  );
  const res = await client.get<{ data: Attendance[] }>(
    `/api/resource/Attendance?filters=${filters}&fields=${fields}&limit_page_length=200&order_by=in_time desc`,
  );
  return res.data.data;
}

/**
 * Staff check-out — goes through the dedicated staff_gate_checkout server
 * script since check-in submits the Attendance doc (docstatus=1) and plain
 * field updates on a submitted doc are otherwise blocked.
 */
export async function checkOutStaffAttendance(attendanceName: string): Promise<{
  success: boolean;
  out_time: string;
  working_hours?: number;
}> {
  return api.checkOutStaffAttendance(attendanceName);
}
