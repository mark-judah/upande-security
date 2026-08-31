import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

/**
 * Guard scans a Staff Vehicle Sticker QR — resolves straight to the one
 * employee it's currently assigned to, plus the vehicle/motorcycle details
 * printed on it. Unlike Supplier Badge's scan, this always resolves to at
 * most one match (a sticker has exactly one holder), so there's no picker
 * step — the caller feeds the resolved employee_id straight into the
 * existing employee lookup + check-in flow.
 */
export function useStaffStickerScan() {
  return useMutation({
    mutationFn: (reference: string) => api.searchStaffVehicleSticker(reference),
  });
}
