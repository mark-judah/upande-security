import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

/**
 * Issues a Supplier Badge to the supplier behind an already-verified Gate
 * Receiving Verification record (see ReceivingGatePanel's post-Verified
 * prompt). `name` is the verification record's own name, same convention
 * as useConfirmReceivingDeparture.
 */
export function useIssueSupplierBadgeForReceiving() {
  const feedback = useFeedback();

  return useMutation({
    mutationFn: ({ name, badgeNumber }: { name: string; badgeNumber: string }) =>
      api.issueSupplierBadgeForReceiving(name, badgeNumber),
    onSuccess: (result) => {
      feedback.success(`Badge #${result.badge_number} issued to ${result.supplier_name} ✓`);
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not issue badge'),
  });
}
