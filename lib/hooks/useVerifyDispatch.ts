import { useMutation } from '@tanstack/react-query';
import { api, type VerifyDispatchInput } from '@/lib/services/api';
import { useDispatchStore } from '@/lib/stores/dispatchStore';
import { useFeedback } from './useFeedback';

type Context = {
  reference_doctype: string;
  vehicle_no: string;
  driver_name: string;
  farm: string;
};

/**
 * Records the guard's Verify / Reject decision. On a Verified result, the
 * dispatch is added to the persisted "awaiting return" list so the guard
 * (or another guard on a later shift) can confirm the return trip at any
 * point afterwards — see `useConfirmDispatchReturn`.
 */
export function useVerifyDispatch() {
  const feedback = useFeedback();
  const addPending = useDispatchStore((s) => s.addPending);

  return useMutation({
    mutationFn: ({ input }: { input: VerifyDispatchInput; context: Context }) =>
      api.verifyDispatchAtGate(input),
    onSuccess: (result, { context }) => {
      if (result.gate_verification_status === 'Verified') {
        addPending({
          name: result.name,
          reference_doctype: context.reference_doctype,
          reference_name: result.reference_name,
          vehicle_no: context.vehicle_no,
          driver_name: context.driver_name,
          farm: context.farm,
          verified_at: new Date().toISOString(),
        });
        feedback.success(`Dispatch ${result.reference_name} verified ✓`);
      } else {
        feedback.warning(`Dispatch ${result.reference_name} rejected at the gate`);
      }
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not record gate decision'),
  });
}
