import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recordTractorGateEntry } from '@/lib/api/vehicles';
import { useFeedback } from './useFeedback';

export function useVehicleEntry() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: { name: string; entryTime: string; farm?: string }) =>
      recordTractorGateEntry(input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['vehicle-ticket', vars.name] });
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      feedback.success('Vehicle entered — timer started ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Entry failed'),
  });
}
