import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkOutStaffAttendance } from '@/lib/api/attendance';
import { useFeedback } from './useFeedback';

export function useStaffCheckOut(employeeId?: string) {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (attendanceName: string) => checkOutStaffAttendance(attendanceName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['staff-attendance-today', employeeId] });
      qc.invalidateQueries({ queryKey: ['staff-attendance-summary'] });
      qc.invalidateQueries({ queryKey: ['checked-in-staff'] });
      feedback.success('Staff checked out ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Check-out failed'),
  });
}
