import { useQuery } from '@tanstack/react-query';
import { fetchMyIncidents } from '@/lib/api/incidents';

export function useMyIncidents(userEmail: string | undefined) {
  return useQuery({
    queryKey: ['incidents', 'mine', userEmail ?? ''],
    queryFn: () => fetchMyIncidents(userEmail!),
    enabled: Boolean(userEmail),
    staleTime: 30 * 1000,
  });
}
