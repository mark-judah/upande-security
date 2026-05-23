// Thin shim over the server-script verbs in lib/services/api.ts.
import { api } from '@/lib/services/api';
import type { StaffSearchResult } from './types';

export async function fetchStaffEmployee(query: string): Promise<StaffSearchResult> {
  const result = await api.searchStaff(query);
  if (!result.found) {
    return {};
  }
  return {
    full_name: result.full_name,
    employee_id: result.employee_id,
  };
}
