// Thin shim over the server-script verb in lib/services/api.ts.
import { api } from '@/lib/services/api';
import type { StaffSearchMatch } from '@/lib/services/api';

export async function searchStaffEmployees(query: string): Promise<StaffSearchMatch[]> {
  const result = await api.searchStaff(query);
  return result.matches;
}
