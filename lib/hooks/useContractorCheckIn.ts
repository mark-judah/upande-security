import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contractorCheckIn, type ContractorCheckInInput } from '@/lib/api/contractors';
import { useFeedback } from './useFeedback';

export function useContractorCheckIn() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: ContractorCheckInInput) => contractorCheckIn(input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['appointment', data.appointment_name] });
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      feedback.success('Contractor checked in ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Contractor check-in failed'),
  });
}
