import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAppointmentStatus } from '@/lib/api/visitors';
import { runWorkflowAction } from '@/lib/api/workflow';
import { toFrappeDateTime } from '@/lib/utils/date';
import { useFeedback } from './useFeedback';

export type CheckInInput = {
  name: string;
  custom_mode_of_transport?: string;
  custom_vehicles_number_plate?: string;
  custom_vehicles_colour?: string;
};

export function useCheckIn() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: async (input: CheckInInput) => {
      await updateAppointmentStatus({
        ...input,
        custom_check_in_time: toFrappeDateTime(),
        custom_reporting_status: 'Checked in',
      });
      return runWorkflowAction({ name: input.name, action: 'Confirm Check In' });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['appointment', vars.name] });
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      feedback.success('Checked in ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Check-in failed'),
  });
}
