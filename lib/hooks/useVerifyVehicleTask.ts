import { useMutation } from '@tanstack/react-query';
import { api, type VerifyVehicleTaskInput } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

/**
 * Records the guard's Exit/Entry decision. An Entry that closes a leg
 * opened by an earlier Exit is the normal case; one that finds no open leg
 * is still recorded, and the guard is told so rather than it passing
 * silently as if the round trip were complete.
 */
export function useVerifyVehicleTask() {
  const feedback = useFeedback();

  return useMutation({
    mutationFn: ({ input }: { input: VerifyVehicleTaskInput }) => api.verifyVehicleTaskAtGate(input),
    onSuccess: (result) => {
      const what = `${result.reference_name} ${result.movement_type.toLowerCase()}`;
      if (result.gate_verification_status === 'Verified') {
        feedback.success(`${what} recorded ✓`);
      } else {
        feedback.warning(`${what} rejected at the gate`);
      }
      if (result.unmatched_entry) {
        feedback.warning('No matching exit on file — recorded as an arrival with no logged departure');
      }
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not record gate decision'),
  });
}
