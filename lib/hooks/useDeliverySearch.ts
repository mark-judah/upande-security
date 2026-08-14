import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

/**
 * Guard types (or scans) a PO number, or a supplier name when that's all
 * they have — read-only lookup against Purchase Order. Safe to call
 * repeatedly as the guard edits the input.
 */
export function useDeliverySearch() {
  return useMutation({
    mutationFn: (reference: string) => api.searchDeliveryForGate(reference),
  });
}
