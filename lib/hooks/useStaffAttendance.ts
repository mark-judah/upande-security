import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createStaffAttendance, submitAttendance } from '@/lib/api/attendance';
import type { Employee } from '@/lib/api/types';
import { useFeedback } from './useFeedback';

export function useStaffAttendance() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: async (input: { employee: Employee; numberPlate?: string }) => {
      const created = await createStaffAttendance(input);
      try {
        await submitAttendance(created.name);
      } catch (e) {
        if (__DEV__) console.warn('[submitAttendance]', e);
        // If submit fails (e.g. HR config requires out_time), keep the draft.
        throw new Error(
          `Attendance ${created.name} created as draft but could not be submitted: ${
            e instanceof Error ? e.message : 'unknown error'
          }`,
        );
      }
      return created;
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      feedback.success(`Attendance ${created.name} recorded`);
    },
    onError: (err: Error) => feedback.error(err.message || 'Check-in failed'),
  });
}
