import { useMutation } from '@tanstack/react-query';
import { api, type VerifyReceivingInput } from '@/lib/services/api';
import { useReceivingStore } from '@/lib/stores/receivingStore';
import { useFeedback } from './useFeedback';

type Context = {
  purchase_order: string;
  supplier_name: string;
  vehicle_no: string;
  driver_name: string;
};

/**
 * Records the guard's Verify / Reject decision. On a Verified result, the
 * receiving is added to the persisted "awaiting departure" list so the
 * guard (or another guard on a later shift) can confirm the truck's
 * departure once offloading is done — see `useConfirmReceivingDeparture`.
 */
export function useVerifyReceiving() {
  const feedback = useFeedback();
  const addPending = useReceivingStore((s) => s.addPending);

  return useMutation({
    mutationFn: ({ input }: { input: VerifyReceivingInput; context: Context }) =>
      api.verifyReceivingAtGate(input),
    onSuccess: (result, { context }) => {
      if (result.gate_verification_status === 'Verified') {
        addPending({
          name: result.name,
          purchase_order: context.purchase_order,
          supplier_name: context.supplier_name,
          vehicle_no: context.vehicle_no,
          driver_name: context.driver_name,
          verified_at: new Date().toISOString(),
        });
        feedback.success(`Receiving for ${result.purchase_order} verified ✓`);
      } else {
        feedback.warning(`Receiving for ${result.purchase_order} rejected at the gate`);
      }
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not record gate decision'),
  });
}
