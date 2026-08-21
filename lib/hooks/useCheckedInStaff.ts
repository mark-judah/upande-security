import { useQuery } from '@tanstack/react-query';
import { fetchCheckedInStaff } from '@/lib/api/attendance';

export function useCheckedInStaff() {
  return useQuery({
    queryKey: ['checked-in-staff'],
    queryFn: fetchCheckedInStaff,
    staleTime: 30 * 1000,
  });
}
