import { useMutation } from '@tanstack/react-query';
import { fetchStaffEmployee } from '@/lib/api/staff';

export function useStaffSearch() {
  return useMutation({
    mutationFn: (query: string) => fetchStaffEmployee(query),
  });
}
