// Thin shim over the server-script verbs in lib/services/api.ts.
// All Employee lookups go through Frappe server scripts — never /api/resource.
import { api } from '@/lib/services/api';
import type { Employee, EmployeeResult } from './types';

export async function fetchEmployee(name: string): Promise<Employee> {
  const e = await api.getEmployee(name);
  return e as unknown as Employee;
}

export async function getEmployeeName(employeeId: string): Promise<string> {
  const e = await api.getEmployee(employeeId);
  return e.employee_name ?? '';
}

export async function searchEmployees(query: string): Promise<EmployeeResult[]> {
  const hits = await api.searchEmployees(query);
  return hits.map((h) => ({
    name: h.name,
    employee_name: h.employee_name,
    designation: h.designation,
    department: h.department,
    status: h.status,
  }));
}
