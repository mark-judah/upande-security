import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

/**
 * Guard scans or types a vehicle's plate/serial — read-only lookup against
 * whichever task doctype Vehicle Task Sources points at. Safe to call
 * repeatedly as the guard edits the input.
 */
export function useVehicleTaskSearch() {
  return useMutation({
    mutationFn: (reference: string) => api.searchVehicleTaskForGate(reference),
  });
}
