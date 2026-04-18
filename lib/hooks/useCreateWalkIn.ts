import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAppointment, type CreateAppointmentInput } from '@/lib/api/visitors';
import { runWorkflowAction } from '@/lib/api/workflow';
import { updateAppointmentStatus } from '@/lib/api/visitors';
import { useFeedback } from './useFeedback';

export function useCreateWalkIn() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const created = await createAppointment(input);
      await updateAppointmentStatus({
        name: created.name,
        custom_check_in_time: new Date().toISOString(),
        custom_reporting_status: 'Visitor Checked In',
      });
      await runWorkflowAction({ name: created.name, action: 'Check In' });
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      feedback.success('Walk-in registered & checked in ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Walk-in failed'),
  });
}
