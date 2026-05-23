import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

export function useApprovedAppointments() {
  return useQuery({
    queryKey: ['approved-appointments'],
    queryFn: () => api.approvedAppointments(),
    refetchInterval: 30_000,
  });
}
