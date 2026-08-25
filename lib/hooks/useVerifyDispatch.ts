import { useMutation } from '@tanstack/react-query';
import { api, type VerifyDispatchInput } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

/**
 * Records the guard's Verify / Reject decision.
 */
export function useVerifyDispatch() {
  const feedback = useFeedback();

  return useMutation({
    mutationFn: ({ input }: { input: VerifyDispatchInput }) => api.verifyDispatchAtGate(input),
    onSuccess: (result) => {
      if (result.gate_verification_status === 'Verified') {
        feedback.success(`Dispatch ${result.reference_name} verified ✓`);
      } else {
        feedback.warning(`Dispatch ${result.reference_name} rejected at the gate`);
      }
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not record gate decision'),
  });
}
