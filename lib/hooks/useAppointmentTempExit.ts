import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setTempExit, type TempExitDirection } from '@/lib/api/tempExit';
import { useFeedback } from './useFeedback';

/**
 * Step Out / Confirm Return for a visitor or contractor Appointment —
 * used by the Summary tab's Currently Inside list (InsideCard).
 */
export function useAppointmentTempExit() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: ({ name, direction }: { name: string; direction: TempExitDirection }) =>
      setTempExit('Appointment', name, direction),
    onSuccess: (_, { name, direction }) => {
      qc.invalidateQueries({ queryKey: ['appointment', name] });
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      feedback.success(direction === 'out' ? 'Stepped out ✓' : 'Welcome back ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not update status'),
  });
}
