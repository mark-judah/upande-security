import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAppointmentStatus } from '@/lib/api/visitors';
import { runWorkflowAction } from '@/lib/api/workflow';
import { useFeedback } from './useFeedback';

export function useCheckOut() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: async (name: string) => {
      await updateAppointmentStatus({
        name,
        custom_check_out_time: new Date().toISOString(),
        custom_reporting_status: 'Visitor Checked Out',
      });
      return runWorkflowAction({ name, action: 'Check Out' });
    },
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ['appointment', name] });
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      feedback.success('Checked out ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Check-out failed'),
  });
}
