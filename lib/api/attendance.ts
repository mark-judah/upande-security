import api from './client';
import type { Attendance, Employee } from './types';
import { toFrappeDateTime } from '@/lib/utils/date';

function toFrappeDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function createStaffAttendance(input: {
  employee: Employee;
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
