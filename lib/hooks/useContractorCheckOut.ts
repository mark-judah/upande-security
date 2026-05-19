import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contractorCheckOut } from '@/lib/api/contractors';
import { useFeedback } from './useFeedback';

export function useContractorCheckOut() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (appointmentName: string) => contractorCheckOut(appointmentName),
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ['appointment', name] });
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      feedback.success('Contractor checked out ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Contractor check-out failed'),
  });
}
