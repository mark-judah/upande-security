import api from './client';
import type { StaffSearchResult } from './types';

export async function fetchStaffEmployee(query: string) {
  const res = await api.post<{ message: StaffSearchResult }>('/api/method/getStaffEmployee', {
    query,
  });
  return res.data.message;
}
