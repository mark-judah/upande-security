import { useQuery } from '@tanstack/react-query';
import { fetchTractorDailyTask } from '@/lib/api/vehicles';

export function useVehicleTicket(name: string | null) {
  return useQuery({
    queryKey: ['vehicle-ticket', name],
    queryFn: () => fetchTractorDailyTask(name!),
    enabled: Boolean(name),
  });
}
