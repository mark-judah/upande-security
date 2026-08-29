import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

/**
 * Guard scans a Supplier Badge QR — resolves to every currently open
 * Purchase Order for that badge's assigned supplier (there can be more
 * than one truck in flight for the same supplier at once).
 */
export function useSupplierBadgeScan() {
  return useMutation({
    mutationFn: (reference: string) => api.searchReceivingByBadge(reference),
  });
}
