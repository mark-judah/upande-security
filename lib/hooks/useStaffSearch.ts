import { useMutation } from '@tanstack/react-query';
import { searchStaffEmployees } from '@/lib/api/staff';

export function useStaffSearch() {
  return useMutation({
    mutationFn: (query: string) => searchStaffEmployees(query),
  });
}
