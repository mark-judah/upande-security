import { useMutation } from '@tanstack/react-query';
import { api, type VerifyDispatchBulkResult, type GateVerificationStatus } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

type Input = {
  references: string[];
  gate_verification_status: GateVerificationStatus;
  remarks?: string;
  gate_arrival_time?: string;
  vehicle_no?: string;
  driver_name?: string;
};

/**
 * Records the guard's Verify / Reject decision for every related_by_vehicle
 * dispatch document additionally selected alongside the one they scanned
 * — one shared vehicle/driver, one guard action. Mirrors useVerifyDispatch,
 * but each reference can independently succeed or fail (a per-reference
 * result union), and there's no shortfall-incident-per-item feedback here
 * since item_checks never apply to these (document-level only).
 */
export function useVerifyDispatchBulk() {
  const feedback = useFeedback();

  return useMutation({
    mutationFn: ({ input }: { input: Input }) => api.verifyDispatchAtGateBulk(input),
    onSuccess: (result: VerifyDispatchBulkResult) => {
      let verifiedCount = 0;
      let rejectedCount = 0;
      let failedCount = 0;
      const shortfallIncidents: string[] = [];

      for (const r of result.results) {
        if ('error' in r) {
          failedCount += 1;
          continue;
        }
        if (r.gate_verification_status === 'Verified') {
          verifiedCount += 1;
        } else {
          rejectedCount += 1;
        }
        if (r.shortfall_incident) {
          shortfallIncidents.push(r.shortfall_incident);
        }
      }

      if (verifiedCount > 0) {
        feedback.success(verifiedCount + (verifiedCount === 1 ? ' dispatch verified ✓' : ' dispatches verified ✓'));
      }
      if (rejectedCount > 0) {
        feedback.warning(rejectedCount + (rejectedCount === 1 ? ' dispatch rejected at the gate' : ' dispatches rejected at the gate'));
      }
      if (failedCount > 0) {
        feedback.error(failedCount + (failedCount === 1 ? ' selection could not be processed' : ' selections could not be processed'));
      }
      if (shortfallIncidents.length > 0) {
        feedback.warning('Shortfall detected — Incident(s) ' + shortfallIncidents.join(', ') + ' filed');
      }
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not record bulk gate decision'),
  });
}
