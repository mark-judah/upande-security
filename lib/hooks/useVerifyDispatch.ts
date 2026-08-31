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
      // Item(s) came up short against the dispatch paperwork — the server
      // already auto-filed a Theft Incident Report for it; this just makes
      // sure the guard actually sees that happened, not a silent side effect.
      if (result.shortfall_incident) {
        feedback.warning(`Shortfall detected — Incident ${result.shortfall_incident} filed`);
      }
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not record gate decision'),
  });
}
