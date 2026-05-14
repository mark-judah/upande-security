import { useQuery } from '@tanstack/react-query';
import { fetchIncidentCategories } from '@/lib/api/incidents';

export function useIncidentCategories() {
  return useQuery({
    queryKey: ['incident-categories'],
    queryFn: fetchIncidentCategories,
    staleTime: 10 * 60 * 1000,
  });
}
