import { useMutation } from '@tanstack/react-query';
import { api, type VerifyReceivingBulkResult, type GateVerificationStatus } from '@/lib/services/api';
import { useReceivingStore } from '@/lib/stores/receivingStore';
import { useFeedback } from './useFeedback';

type Context = {
  // The bulk endpoint's per-reference results don't carry supplier_name
  // (see VerifyReceivingBulkHit) — keep it around client-side, keyed by
  // the same `reference` (purchase_order) sent in the request, so a
  // Verified hit can still be added to the "awaiting departure" list with
  // a readable supplier name instead of falling back to the PO number.
  supplierNameByReference: Record<string, string>;
  vehicle_no: string;
  driver_name: string;
};

type Input = {
  references: string[];
  gate_verification_status: GateVerificationStatus;
  vehicle_no?: string;
  driver_name?: string;
  remarks?: string;
};

/**
 * Records the guard's Verify / Reject decision for every PO selected off
 * one Supplier Badge scan, in one action against a single shared
 * vehicle/driver. Mirrors useVerifyReceiving, but each reference can
 * independently succeed or fail — results are a per-reference union, not
 * a single pass/fail for the whole call.
 */
export function useVerifyReceivingBulk() {
  const feedback = useFeedback();
  const addPending = useReceivingStore((s) => s.addPending);

  return useMutation({
    mutationFn: ({ input }: { input: Input; context: Context }) => api.verifyReceivingAtGateBulk(input),
    onSuccess: (result: VerifyReceivingBulkResult, { context }) => {
      let verifiedCount = 0;
      let rejectedCount = 0;
      let failedCount = 0;

      for (const r of result.results) {
        if ('error' in r) {
          failedCount += 1;
          continue;
        }
        if (r.gate_verification_status === 'Verified') {
          verifiedCount += 1;
          addPending({
            name: r.name,
            purchase_order: r.purchase_order,
            supplier_name: context.supplierNameByReference[r.purchase_order] ?? r.purchase_order,
            vehicle_no: context.vehicle_no,
            driver_name: context.driver_name,
            verified_at: new Date().toISOString(),
          });
        } else {
          rejectedCount += 1;
        }
      }

      if (verifiedCount > 0) {
        feedback.success(verifiedCount + (verifiedCount === 1 ? ' PO verified ✓' : ' POs verified ✓'));
      }
      if (rejectedCount > 0) {
        feedback.warning(rejectedCount + (rejectedCount === 1 ? ' PO rejected at the gate' : ' POs rejected at the gate'));
      }
      if (failedCount > 0) {
        feedback.error(failedCount + (failedCount === 1 ? ' selection could not be processed' : ' selections could not be processed'));
      }
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not record bulk gate decision'),
  });
}
