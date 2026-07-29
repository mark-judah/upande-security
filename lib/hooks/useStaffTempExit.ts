import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setTempExit, type TempExitDirection } from '@/lib/api/tempExit';
import { useFeedback } from './useFeedback';

/**
 * Step Out / Confirm Return for a staff Attendance record — used by the
 * gate StaffCheckInPanel when a checked-in employee scans back in.
 */
export function useStaffTempExit(employeeId?: string) {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: ({ name, direction }: { name: string; direction: TempExitDirection }) =>
      setTempExit('Attendance', name, direction),
    onSuccess: (_, { direction }) => {
      qc.invalidateQueries({ queryKey: ['staff-attendance-today', employeeId] });
      qc.invalidateQueries({ queryKey: ['staff-attendance-summary'] });
      feedback.success(direction === 'out' ? 'Stepped out ✓' : 'Welcome back ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not update status'),
  });
}
