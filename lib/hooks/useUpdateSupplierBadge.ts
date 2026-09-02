import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type UpdateSupplierBadgeInput } from '@/lib/services/api';

/**
 * Command Center — Supplier Badge edit/issue. Same verb handles both:
 * issuing a badge is just setting supplier + company + status="Active" on
 * a currently "Unassigned" badge, no separate action. Invalidates
 * useSupplierBadges' `['command-center-supplier-badges', status, company,
 * limit]` key prefix so every filter/company grouping currently mounted
 * refreshes.
 */
export function useUpdateSupplierBadge() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSupplierBadgeInput) => api.updateSupplierBadge(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['command-center-supplier-badges'] });
    },
  });
}
