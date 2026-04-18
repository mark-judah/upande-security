import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recordTractorGateExit } from '@/lib/api/vehicles';
import { useFeedback } from './useFeedback';

export function useVehicleExit() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: { name: string; exitTime: string; completionNote: string }) =>
      recordTractorGateExit(input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['vehicle-ticket', vars.name] });
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      feedback.success('Vehicle exited — task complete ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Exit failed'),
  });
}
