// Thin shim over the server-script verbs in lib/services/api.ts.
import { api } from '@/lib/services/api';
import type { Attendance, Employee } from './types';

export async function createStaffAttendance(input: {
  employee: Employee;
  numberPlate?: string;
}): Promise<Attendance> {
  const result = await api.createStaffAttendance(
    input.employee.name,
    input.numberPlate?.trim() || undefined,
  );
  return result as unknown as Attendance;
}

export async function submitAttendance(name: string): Promise<Attendance> {
  const result = await api.submitStaffAttendance(name);
  return result as unknown as Attendance;
}
