import { useQuery } from '@tanstack/react-query';
import { fetchAppointmentDoc } from '@/lib/api/visitors';

export function useAppointmentWorkflowState(name: string | null) {
  return useQuery({
    queryKey: ['appointment', name],
    queryFn: () => fetchAppointmentDoc(name!),
    enabled: Boolean(name),
  });
}
