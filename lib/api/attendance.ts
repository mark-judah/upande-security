// Thin shim over the server-script verbs in lib/services/api.ts.
import { api } from '@/lib/services/api';
import type { Attendance, Employee } from './types';

export async function createStaffAttendance(input: {
  employee: Employee;
  vehiclePlate?: string;
}): Promise<Attendance> {
  const result = await api.createStaffAttendance(input.employee.name, input.vehiclePlate);
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
 * Was a raw /api/resource/Attendance REST call — Attendance's own DocPerm
 * only grants read to System Manager/HR User/HR Manager/the Employee role,
 * none of which a Gate Guard without an HR-linked Employee record (most
 * external/outsourced guards) ever has, so that call threw a genuine 403
 * the instant a staff match was picked, which the axios interceptor treats
 * as a dead session — looked like the app going back to home / a forced
 * logout, for what was actually just a missing read permission on one
 * doctype. get_today_attendance.py sidesteps this with frappe.get_all
 * (permission-unchecked), matching every other staff-attendance verb.
 */
export async function fetchTodayAttendance(employeeId: string): Promise<Attendance | null> {
  const result = await api.getTodayAttendance(employeeId);
  return (result.attendance as unknown as Attendance) ?? null;
}

/**
 * Every submitted Attendance record for today, across all employees — used
 * to show a staff activity section on the gate Summary tab. Same fix as
 * fetchTodayAttendance above.
 */
export async function fetchTodayStaffAttendance(): Promise<Attendance[]> {
  const result = await api.listTodayStaffAttendance();
  return result.attendance as unknown as Attendance[];
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

/**
 * Staff currently checked in via THIS app (custom_gate_app_entry=1) and not
 * yet checked out — deliberately not the general Attendance list, which
 * would also include biometric/HR-imported rows the gate app never touched.
 */
export async function fetchCheckedInStaff() {
  const result = await api.listCheckedInStaff();
  return result.staff;
}
