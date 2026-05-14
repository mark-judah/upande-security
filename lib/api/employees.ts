import api from './client';
import type { Employee, EmployeeResult } from './types';

export async function fetchEmployee(name: string): Promise<Employee> {
  const res = await api.get<{ data: Employee }>(
    `/api/resource/Employee/${encodeURIComponent(name)}`,
  );
  return res.data.data;
}

export async function getEmployeeName(employeeId: string) {
  const fields = encodeURIComponent(JSON.stringify(['employee_name']));
  const res = await api.get<{ data: { employee_name: string } }>(
    `/api/resource/Employee/${encodeURIComponent(employeeId)}?fields=${fields}`,
  );
  return res.data.data.employee_name;
}

export async function searchEmployees(query: string) {
  const filters = encodeURIComponent(
    JSON.stringify([
      ['Employee', 'employee_name', 'like', `%${query}%`],
      ['Employee', 'status', '=', 'Active'],
    ]),
  );
  const fields = encodeURIComponent(
    JSON.stringify(['name', 'employee_name', 'designation', 'department', 'status']),
  );
  const res = await api.get<{ data: EmployeeResult[] }>(
    `/api/resource/Employee?filters=${filters}&fields=${fields}&limit_page_length=20&order_by=employee_name asc`,
  );
  return res.data.data;
}
