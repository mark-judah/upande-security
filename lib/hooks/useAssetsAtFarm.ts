import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

export function useAssetsAtFarm() {
  return useQuery({
    queryKey: ['my-assets-at-farm'],
    queryFn: async () => {
      const res = await api.myAssetsAtFarm();
      return res.assets;
    },
    staleTime: 2 * 60 * 1000,
  });
}
