import { useMutation, useQueryClient } from '@tanstack/react-query';
import { filePatrolReport } from '@/lib/api/patrol';
import type { FilePatrolReportInput } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

export function useFilePatrolReport() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: FilePatrolReportInput) => filePatrolReport(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      feedback.success(
        result.updated ? `Patrol report ${result.name} updated` : `Patrol report ${result.name} filed`,
      );
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not file patrol report'),
  });
}
