import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createWalkInAppointment, type CreateAppointmentInput } from '@/lib/api/visitors';
import { useFeedback } from './useFeedback';

export function useCreateWalkIn() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: CreateAppointmentInput) => createWalkInAppointment(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      feedback.success('Walk-in registered & checked in');
    },
    onError: (err: Error) => feedback.error(err.message || 'Walk-in failed'),
  });
}
