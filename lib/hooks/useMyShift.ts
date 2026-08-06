import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

export function useMyShift() {
  return useQuery({
    queryKey: ['my-shift'],
    queryFn: async () => {
      const res = await api.myCurrentShift();
      return res.shift;
    },
    staleTime: 5 * 60 * 1000,
  });
}
