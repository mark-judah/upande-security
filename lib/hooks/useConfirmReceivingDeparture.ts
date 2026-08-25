import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import { useReceivingStore } from '@/lib/stores/receivingStore';
import { useFeedback } from './useFeedback';

/**
 * Stamps `gate_departure_time` on a previously verified Gate Receiving
 * Verification, once the truck actually leaves after offloading. `name`
 * here is the verification record's own name (returned by
 * verify_receiving_at_gate), not the Purchase Order.
 */
export function useConfirmReceivingDeparture() {
  const feedback = useFeedback();
  const removePending = useReceivingStore((s) => s.removePending);

  return useMutation({
    mutationFn: (name: string) => api.confirmReceivingDeparture(name),
    onSuccess: (result) => {
      removePending(result.name);
      feedback.success('Departure confirmed ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not confirm departure'),
  });
}
