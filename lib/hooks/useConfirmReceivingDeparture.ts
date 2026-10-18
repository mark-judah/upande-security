import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ReceivingExitCheck } from '@/lib/services/api';
import { useReceivingStore } from '@/lib/stores/receivingStore';
import { useFeedback } from './useFeedback';

/**
 * Stamps `gate_departure_time` on a previously verified Gate Receiving
 * Verification, once the truck actually leaves after offloading. `name`
 * here is the verification record's own name (returned by
 * verify_receiving_at_gate), not the Purchase Order. With `exit`, the
 * supplier's items are checked out too (see ReceivingExitSheet).
 */
export function useConfirmReceivingDeparture() {
  const feedback = useFeedback();
  const qc = useQueryClient();
  const removePending = useReceivingStore((s) => s.removePending);

  return useMutation({
    mutationFn: ({ name, exit }: { name: string; exit?: ReceivingExitCheck }) =>
      api.confirmReceivingDeparture(name, exit),
    onSuccess: (result) => {
      (result.records ?? [result.name]).forEach(removePending);
      qc.invalidateQueries({ queryKey: ['receiving-awaiting'] });
      if (result.not_seen_leaving?.length) {
        feedback.warning('Departure confirmed. Not seen leaving: ' + result.not_seen_leaving.join(', '));
      } else if (result.left_with_document?.length) {
        feedback.success('Departure confirmed. Left with documents: ' + result.left_with_document.join(', '));
      } else {
        feedback.success('Departure confirmed ✓');
      }
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not confirm departure'),
  });
}
