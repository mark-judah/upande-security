import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import { useDeliveryStore } from '@/lib/stores/deliveryStore';
import { useFeedback } from './useFeedback';

/**
 * Stamps `gate_departure_time` on a previously verified Gate Delivery
 * Verification, once the truck actually leaves after offloading. `name`
 * here is the verification record's own name (returned by
 * verify_delivery_at_gate), not the Purchase Order.
 */
export function useConfirmDeliveryDeparture() {
  const feedback = useFeedback();
  const removePending = useDeliveryStore((s) => s.removePending);

  return useMutation({
    mutationFn: (name: string) => api.confirmDeliveryDeparture(name),
    onSuccess: (result) => {
      removePending(result.name);
      feedback.success('Departure confirmed ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not confirm departure'),
  });
}
