import { useMutation } from '@tanstack/react-query';
import { searchTractorDailyTasks } from '@/lib/api/vehicles';

export function useTractorTaskSearch() {
  return useMutation({
    mutationFn: (query: string) => searchTractorDailyTasks(query),
  });
}
