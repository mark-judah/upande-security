import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAppointment, type CreateAppointmentInput } from '@/lib/api/visitors';
import { updateAppointmentStatus } from '@/lib/api/visitors';
import { runWorkflowAction } from '@/lib/api/workflow';
import { toFrappeDateTime } from '@/lib/utils/date';
import { useFeedback } from './useFeedback';

export function useCreateWalkIn() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const created = await createAppointment(input);
      await updateAppointmentStatus({
        name: created.name,
        custom_check_in_time: toFrappeDateTime(),
        custom_reporting_status: 'Checked in',
      });
      try {
        await runWorkflowAction({ name: created.name, action: 'Confirm Check In' });
      } catch (e) {
        // Workflow transition may fail if the current state doesn't expose this action.
        // The appointment itself is created + check-in time stamped, so treat as soft failure.
        if (__DEV__) {
          console.warn('[useCreateWalkIn] workflow transition failed:', e);
        }
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      feedback.success('Walk-in registered & checked in');
    },
    onError: (err: Error) => feedback.error(err.message || 'Walk-in failed'),
  });
}
