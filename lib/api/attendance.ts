import api from './client';
import type { Attendance, Employee } from './types';
import type { TransportMode } from '@/constants/transportModes';
import { toFrappeDateTime } from '@/lib/utils/date';

function toFrappeDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function createStaffAttendance(input: {
  employee: Employee;
  transportMode?: TransportMode;
  numberPlate?: string;
}): Promise<Attendance> {
  const emp = input.employee;
  const body: Partial<Attendance> = {
    naming_series: 'HR-ATT-.YYYY.-',
    employee: emp.name,
    employee_name: emp.employee_name,
    status: 'Present',
    attendance_date: toFrappeDate(),
    in_time: toFrappeDateTime(),
    company: emp.company,
    department: emp.department,
    shift: emp.default_shift,
    custom_farm: emp.custom_farm,
    custom_location: emp.custom_location,
    custom_employee_category: emp.custom_employee_category,
    custom_mode_of_transport: input.transportMode ?? 'On Foot',
  };
  if (input.numberPlate && input.numberPlate.trim()) {
    body.custom_vehicle_number_plate = input.numberPlate.trim();
  }
  const res = await api.post<{ data: Attendance }>('/api/resource/Attendance', body);
  return res.data.data;
}

export async function submitAttendance(name: string): Promise<Attendance> {
  const getRes = await api.get<{ data: Attendance }>(
    `/api/resource/Attendance/${encodeURIComponent(name)}`,
  );
  const doc = getRes.data.data;
  doc.docstatus = 1;
  const res = await api.post<{ message: Attendance }>('/api/method/frappe.client.submit', {
    doc: JSON.stringify(doc),
  });
  return res.data.message;
}

/**
 * Today's most recent submitted Attendance record for an employee, if any.
 * Used to decide whether the gate should offer CHECK IN or CHECK OUT.
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
  const res = await api.get<{ data: Attendance[] }>(
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
      'custom_mode_of_transport',
      'custom_vehicle_number_plate',
      'custom_temp_exit_time',
    ]),
  );
  const res = await api.get<{ data: Attendance[] }>(
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
  const params = new URLSearchParams();
  params.append('attendance_name', attendanceName);
  const res = await api.post<{
    message: { success: boolean; out_time: string; working_hours?: number };
  }>('/api/method/staff_gate_checkout', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return res.data.message;
}
