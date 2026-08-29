import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

/**
 * Active gates configured for a farm (Security Ops Settings' Farm Gates
 * table), main gate first. A farm with zero configured gates just gets an
 * empty list back — GatePicker treats that as "nothing to pick, don't ask".
 */
export function useFarmGates(farm: string | null | undefined) {
  return useQuery({
    queryKey: ['farm-gates', farm],
    queryFn: () => api.getFarmGates(farm as string),
    enabled: !!farm,
    staleTime: 5 * 60 * 1000,
  });
}
