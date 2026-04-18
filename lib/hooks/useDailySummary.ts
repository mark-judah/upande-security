import { useQuery } from '@tanstack/react-query';
import { fetchDailySummary } from '@/lib/api/summary';

export function useDailySummary(date: Date = new Date()) {
  const key = date.toISOString().slice(0, 10);
  return useQuery({
    queryKey: ['daily-summary', key],
    queryFn: () => fetchDailySummary({ date }),
    staleTime: 5 * 60 * 1000,
  });
}
