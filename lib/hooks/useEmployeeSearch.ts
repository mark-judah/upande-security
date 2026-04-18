import { useQuery } from '@tanstack/react-query';
import { searchEmployees } from '@/lib/api/employees';

export function useEmployeeSearch(query: string) {
  return useQuery({
    queryKey: ['employee-search', query],
    queryFn: () => searchEmployees(query),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}
