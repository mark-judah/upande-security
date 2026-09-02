import { useQuery } from '@tanstack/react-query';
import { api, type ListSupplierBadgesInput } from '@/lib/services/api';

/** Command Center — Supplier Badges, read-only list (no create/edit
 *  mutation endpoint exists yet). */
export function useSupplierBadges(input: ListSupplierBadgesInput = {}) {
  return useQuery({
    queryKey: ['command-center-supplier-badges', input.status ?? '', input.company ?? '', input.limit ?? null],
    queryFn: () => api.listSupplierBadges(input),
    staleTime: 5 * 60 * 1000,
  });
}
