import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

export function useGateActivity() {
  return useQuery({
    queryKey: ['gate-activity'],
    queryFn: () => api.gateActivity(),
    refetchInterval: 30_000,
  });
}
