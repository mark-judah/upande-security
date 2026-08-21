import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type BookCustomerAppointmentInput } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

/**
 * Books a future customer visit ("Book Visit" gate chip). New appointments
 * land in Pending Host Review server-side, so a successful booking can
 * surface in both the Approvals tab and the Summary/activity feeds —
 * invalidate both.
 */
export function useBookCustomerAppointment() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: BookCustomerAppointmentInput) => api.bookCustomerAppointment(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      qc.invalidateQueries({ queryKey: ['gate-activity'] });
      feedback.success(`Appointment booked for ${result.customer_name} — pending host review`);
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not book appointment'),
  });
}
