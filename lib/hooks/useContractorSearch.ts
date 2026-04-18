import { useMutation } from '@tanstack/react-query';
import { fetchContractorContract } from '@/lib/api/contractors';

export function useContractorSearch() {
  return useMutation({
    mutationFn: (query: string) => fetchContractorContract(query),
  });
}
